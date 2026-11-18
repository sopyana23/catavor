#!/usr/bin/env bash
# ==============================================================================
# Catavor Zero-Surprise Production Backup & Cutover Orchestrator (VPS Linux)
#
# Urutan eksekusi disiplin produksi (Fail-Fast, bebas ketergantungan python3):
#   1. Preflight check (.env.production, Redis PONG, PostgreSQL TLS, Proxy syntax)
#   2. Backup wajib pg_dump format custom (-Fc) + verifikasi pg_restore --list + SHA-256
#   3. Build bundel Tri-Frontend (desktop, tablet, mobile) & binary Go statis
#   4. Penyiapan direktori storage publik (0750) & privat (0700)
#   5. Eksekusi migrasi skema (catavor-admin-cli -migrate atau -bootstrap-schema)
#   6. Restart systemd catavor.service + verifikasi /healthz & /readyz HTTP 200
#   7. Audit kuorum Gate #5 (catavor-admin-cli -check-go-live)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/catavor/.env.production}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/catavor}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/catavor}"
SERVICE_NAME="${SERVICE_NAME:-catavor.service}"
PROXY_TYPE="${PROXY_TYPE:-none}"
BOOTSTRAP_EMPTY_DB="${BOOTSTRAP_EMPTY_DB:-0}"
APP_USER="${APP_USER:-catavor}"
APP_GROUP="${APP_GROUP:-catavor}"

echo "=== [1/7] Menjalankan Preflight Check Produksi ==="
ENV_FILE="$ENV_FILE" PROXY_TYPE="$PROXY_TYPE" bash "$SCRIPT_DIR/preflight-check.sh"

declare -A ENV_MAP=()
while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    trimmed="${line#"${line%%[![:space:]]*}"}"
    if [[ -z "$trimmed" || "${trimmed:0:1}" == "#" || "$trimmed" != *"="* ]]; then
        continue
    fi
    k="${trimmed%%=*}"
    v="${trimmed#*=}"
    k="${k%"${k##*[![:space:]]}"}"
    v="${v#"${v%%[![:space:]]*}"}"
    v="${v%"${v##*[![:space:]]}"}"
    if [[ ${#v} -ge 2 ]]; then
        if [[ "${v:0:1}" == '"' && "${v: -1}" == '"' ]]; then
            v="${v:1:${#v}-2}"
        elif [[ "${v:0:1}" == "'" && "${v: -1}" == "'" ]]; then
            v="${v:1:${#v}-2}"
        fi
    fi
    ENV_MAP["$k"]="$v"
done < "$ENV_FILE"

DB_HOST="${ENV_MAP[DB_HOST]:-127.0.0.1}"
DB_PORT="${ENV_MAP[DB_PORT]:-5432}"
DB_USER="${ENV_MAP[DB_USER]:-postgres}"
DB_PASS="${ENV_MAP[DB_PASSWORD]:-}"
DB_NAME="${ENV_MAP[DB_NAME]:-catavor}"
DB_SSL="${ENV_MAP[DB_SSLMODE]:-require}"
STORAGE_PUB="${ENV_MAP[STORAGE_LOCAL_ROOT]:-/var/lib/catavor/storage}"
STORAGE_PRIV="${ENV_MAP[STORAGE_PRIVATE_ROOT]:-/var/lib/catavor/private_storage}"
VITE_G_ID="${ENV_MAP[VITE_GOOGLE_CLIENT_ID]:-}"
PORT_VAL="${ENV_MAP[PORT]:-8000}"

if [[ "$BOOTSTRAP_EMPTY_DB" != "1" ]]; then
    echo "=== [2/7] Membuat Snapshot Backup PostgreSQL Pra-Cutover ==="
    umask 077
    mkdir -p "$BACKUP_DIR"
    chmod 0700 "$BACKUP_DIR"
    TS_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
    DUMP_FILE="$BACKUP_DIR/${DB_NAME}_pre_cutover_${TS_UTC}.dump"

    PGPASSWORD="$DB_PASS" PGSSLMODE="$DB_SSL" pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -Fc --no-owner --no-acl -f "$DUMP_FILE"

    if [[ ! -s "$DUMP_FILE" ]]; then
        echo "[ABORT] Berkas backup $DUMP_FILE kosong! Menghentikan proses cutover." >&2
        exit 1
    fi
    pg_restore --list "$DUMP_FILE" >/dev/null
    sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"
    chmod 0600 "$DUMP_FILE" "${DUMP_FILE}.sha256"
    echo "[OK] Backup terverifikasi: $DUMP_FILE"
else
    echo "=== [2/7] Mode BOOTSTRAP_EMPTY_DB=1 aktif (instalasi perdana DB kosong) ==="
fi

echo "=== [3/7] Mengompilasi Tri-Frontend & Binary Backend Go ==="
for spa in desktop tablet mobile; do
    echo "  -> Membangun frontend/$spa ..."
    (
        cd "$REPO_ROOT/frontend/$spa"
        npm ci --no-audit --no-fund
        VITE_GOOGLE_CLIENT_ID="$VITE_G_ID" NODE_OPTIONS="--max-old-space-size=4096" npm run build
    )
done

STAGE_BIN="$(mktemp -d)"
cleanup_stage() {
    rm -rf "$STAGE_BIN"
}
trap cleanup_stage EXIT

(
    cd "$REPO_ROOT/backend"
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$STAGE_BIN/catavor-server" ./cmd/server
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$STAGE_BIN/catavor-admin-cli" ./cmd/admin-cli
)

mkdir -p "$INSTALL_ROOT/bin" "$INSTALL_ROOT/public"
install -m 0755 "$STAGE_BIN/catavor-server" "$INSTALL_ROOT/bin/catavor-server"
install -m 0755 "$STAGE_BIN/catavor-admin-cli" "$INSTALL_ROOT/bin/catavor-admin-cli"

for spa in desktop tablet mobile; do
    rm -rf "$INSTALL_ROOT/public/${spa}.next"
    cp -a "$REPO_ROOT/public/$spa" "$INSTALL_ROOT/public/${spa}.next"
    rm -rf "$INSTALL_ROOT/public/${spa}.old"
    if [[ -d "$INSTALL_ROOT/public/$spa" ]]; then
        mv "$INSTALL_ROOT/public/$spa" "$INSTALL_ROOT/public/${spa}.old"
    fi
    mv "$INSTALL_ROOT/public/${spa}.next" "$INSTALL_ROOT/public/$spa"
    rm -rf "$INSTALL_ROOT/public/${spa}.old"
done

echo "=== [4/7] Menyiapkan Direktori Storage Terisolasi ==="
mkdir -p "$STORAGE_PUB" "$STORAGE_PRIV"
chmod 0750 "$STORAGE_PUB"
chmod 0700 "$STORAGE_PRIV"
if id "$APP_USER" >/dev/null 2>&1; then
    chown -R "$APP_USER:$APP_GROUP" "$STORAGE_PUB" "$STORAGE_PRIV" "$INSTALL_ROOT/public"
fi

echo "=== [5/7] Menjalankan Migrasi Database Produksi ==="
run_cli_with_env() {
    (
        export SKIP_DOTENV="true"
        for k in "${!ENV_MAP[@]}"; do
            export "$k=${ENV_MAP[$k]}"
        done
        exec "$INSTALL_ROOT/bin/catavor-admin-cli" "$@"
    )
}

if [[ "$BOOTSTRAP_EMPTY_DB" == "1" ]]; then
    run_cli_with_env -bootstrap-schema
else
    run_cli_with_env -migrate
fi

echo "=== [6/7] Merestart Layanan $SERVICE_NAME & Memeriksa Probe Kesehatan ==="
systemctl daemon-reload
systemctl restart "$SERVICE_NAME"

READY_OK=0
for i in $(seq 1 30); do
    if curl -fsS -m 2 "http://127.0.0.1:${PORT_VAL}/healthz" >/dev/null 2>&1 && \
       curl -fsS -m 2 "http://127.0.0.1:${PORT_VAL}/readyz" >/dev/null 2>&1; then
        echo "[OK] Layanan sehat (/healthz & /readyz HTTP 200 dalam ${i} detik)."
        READY_OK=1
        break
    fi
    sleep 1
done

if [[ "$READY_OK" != "1" ]]; then
    echo "[GAGAL] Layanan tidak merespons siap pada port ${PORT_VAL} dalam 30 detik!" >&2
    journalctl -u "$SERVICE_NAME" -n 50 --no-pager >&2 || true
    exit 1
fi

echo "=== [7/7] Memeriksa Gate #5 (Kuorum >= 2 Superadmin & Penegakan MFA Staf) ==="
if ! run_cli_with_env -check-go-live; then
    echo "[PERHATIAN] Layanan telah aktif, namun kuorum >= 2 Superadmin belum lengkap. Segera jalankan onboarding Superadmin sesuai GO_LIVE_RUNBOOK.md!" >&2
    exit 2
fi

echo "[SELESAI] Cutover Produksi Catavor tuntas dan seluruh gerbang kesiapan terverifikasi."

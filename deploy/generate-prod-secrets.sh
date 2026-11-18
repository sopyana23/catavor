#!/usr/bin/env bash
# ==============================================================================
# Catavor Production Cryptographic Secret Provisioner (Linux/macOS/Git-Bash — Gate #1)
#
# Membangkitkan kunci acak kriptografis (CSPRNG 256-bit) yang terpisah antara
# JWT_SECRET, MFA_ENCRYPTION_KEY, REDIS_PASSWORD, dan DB_PASSWORD dari template
# deploy/env.production.example tanpa mencetak nilai rahasia ke terminal/log
# dan tanpa ketergantungan pada python3 (cukup bash + awk + openssl / /dev/urandom).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${TEMPLATE_FILE:-$SCRIPT_DIR/env.production.example}"
OUT_FILE="${OUT_FILE:-$SCRIPT_DIR/.env.production}"
FORCE_OVERWRITE="${FORCE_OVERWRITE:-0}"
DRY_RUN="${DRY_RUN:-0}"

for arg in "$@"; do
    case "$arg" in
        --force) FORCE_OVERWRITE=1 ;;
        --dry-run) DRY_RUN=1 ;;
        --out=*) OUT_FILE="${arg#*=}" ;;
        *)
            echo "[ABORT] Argumen tidak dikenal: $arg (gunakan --force, --dry-run, atau --out=/path/.env.production)" >&2
            exit 1
            ;;
    esac
done

if [[ ! -f "$TEMPLATE_FILE" ]]; then
    echo "[ABORT] Berkas template tidak ditemukan: $TEMPLATE_FILE" >&2
    exit 1
fi

if [[ -f "$OUT_FILE" && "$FORCE_OVERWRITE" != "1" && "$DRY_RUN" != "1" ]]; then
    echo "[ABORT] Berkas $OUT_FILE sudah ada. Menolak menimpa agar MFA_ENCRYPTION_KEY aktif tidak terhapus tanpa sengaja." >&2
    echo "        Gunakan --force HANYA pada instalasi baru atau rotasi kunci terencana." >&2
    exit 1
fi

gen_hex_32() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32 | tr -d '\r\n '
    elif [[ -r /dev/urandom ]] && command -v od >/dev/null 2>&1; then
        od -An -N32 -tx1 /dev/urandom | tr -d ' \r\n'
    else
        echo "[ABORT] Membutuhkan openssl atau /dev/urandom untuk CSPRNG." >&2
        exit 1
    fi
}

JWT_KEY="$(gen_hex_32)"
MFA_KEY="$(gen_hex_32)"
REDIS_PASS="$(gen_hex_32)"
DB_PASS="$(gen_hex_32)"

if [[ "$JWT_KEY" == "$MFA_KEY" || ${#JWT_KEY} -lt 64 || ${#MFA_KEY} -lt 64 ]]; then
    echo "[ABORT] Kegagalan validasi entropi atau pemisahan kunci CSPRNG." >&2
    exit 1
fi

for ph in "<GENERATE_WITH_DEPLOY_SCRIPT>" "<GENERATE_DISTINCT_WITH_DEPLOY_SCRIPT>" "<GENERATE_REDIS_PASSWORD_WITH_DEPLOY_SCRIPT>" "<GENERATE_DB_PASSWORD_WITH_DEPLOY_SCRIPT>"; do
    if ! grep -Fq "$ph" "$TEMPLATE_FILE"; then
        echo "[ABORT] Placeholder $ph tidak ditemukan pada $TEMPLATE_FILE." >&2
        exit 1
    fi
done

if [[ "$DRY_RUN" == "1" ]]; then
    echo "[OK] DRY_RUN=1: Berhasil memverifikasi CSPRNG (JWT_SECRET=64 hex, MFA_ENCRYPTION_KEY=64 hex terpisah, REDIS_PASSWORD=64 hex, DB_PASSWORD=64 hex). Tidak menulis ke disk."
    exit 0
fi

umask 077
OUT_DIR="$(dirname "$OUT_FILE")"
mkdir -p "$OUT_DIR"
TMP_OUT="$(mktemp "${OUT_FILE}.tmp.XXXXXX")"
cleanup_tmp() {
    rm -f "$TMP_OUT"
}
trap cleanup_tmp EXIT

# Substitusi lewat ENVIRON di awk agar nilai rahasia TIDAK muncul di argumen proses (ps aux).
JWT_KEY="$JWT_KEY" MFA_KEY="$MFA_KEY" REDIS_PASS="$REDIS_PASS" DB_PASS="$DB_PASS" \
awk '{
    gsub(/<GENERATE_WITH_DEPLOY_SCRIPT>/, ENVIRON["JWT_KEY"])
    gsub(/<GENERATE_DISTINCT_WITH_DEPLOY_SCRIPT>/, ENVIRON["MFA_KEY"])
    gsub(/<GENERATE_REDIS_PASSWORD_WITH_DEPLOY_SCRIPT>/, ENVIRON["REDIS_PASS"])
    gsub(/<GENERATE_DB_PASSWORD_WITH_DEPLOY_SCRIPT>/, ENVIRON["DB_PASS"])
    print
}' "$TEMPLATE_FILE" > "$TMP_OUT"

chmod 0600 "$TMP_OUT"
mv -f "$TMP_OUT" "$OUT_FILE"
chmod 0600 "$OUT_FILE"

echo "[BERHASIL] Berkas rahasia produksi berhasil dibuat di: $OUT_FILE (mode 0600)."
echo "           Langkah selanjutnya: sesuaikan CATAVOR_DOMAIN, APP_URL, ALLOWED_ORIGINS, GOOGLE_CLIENT_*, dan SMTP_*."

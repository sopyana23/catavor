#!/usr/bin/env bash
# ==============================================================================
# Catavor Production Pre-Cutover Validator (Gate #1, #2, #3, & #4)
#
# Memvalidasi postur rahasia (.env.production), pemisahan kunci kriptografis MFA,
# TLS PostgreSQL, konektivitas fail-closed Redis, serta sintaks Reverse Proxy
# SEBELUM proses deploy/cutover menyentuh layanan produksi.
# Bebas ketergantungan python3 (murni Bash + sha256sum/openssl).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.production}"
PROXY_TYPE="${PROXY_TYPE:-none}"
SKIP_LIVE_PROBES="${SKIP_LIVE_PROBES:-0}"
SKIP_PERM_CHECK="${SKIP_PERM_CHECK:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "[GAGAL] Berkas konfigurasi produksi tidak ditemukan: $ENV_FILE" >&2
    echo "        Jalankan 'bash deploy/generate-prod-secrets.sh' terlebih dahulu." >&2
    exit 1
fi

if [[ "$SKIP_PERM_CHECK" != "1" ]]; then
    PERM_OCTAL="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo "")"
    if [[ -n "$PERM_OCTAL" && "$PERM_OCTAL" != "600" && "$PERM_OCTAL" != "400" ]]; then
        echo "[GAGAL] Izin berkas $ENV_FILE terlalu terbuka ($PERM_OCTAL). Wajib 600 atau 400 ('chmod 600 $ENV_FILE')." >&2
        exit 1
    fi
fi

declare -A CFG=()
while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    trimmed="${line#"${line%%[![:space:]]*}"}"
    if [[ -z "$trimmed" || "${trimmed:0:1}" == "#" || "$trimmed" != *"="* ]]; then
        continue
    fi
    key="${trimmed%%=*}"
    val="${trimmed#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ ${#val} -ge 2 ]]; then
        if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then
            val="${val:1:${#val}-2}"
        elif [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then
            val="${val:1:${#val}-2}"
        fi
    fi
    CFG["$key"]="$val"
done < "$ENV_FILE"

ERRORS=()
is_placeholder() {
    local v="${1:-}"
    local low="${v,,}"
    [[ -z "$v" || ( "$v" == *"<"* && "$v" == *">"* ) || "$low" == your_* ]]
}

sha256_str() {
    if command -v sha256sum >/dev/null 2>&1; then
        printf '%s' "$1" | sha256sum | awk '{print $1}'
    else
        printf '%s' "$1" | openssl dgst -sha256 | awk '{print $NF}'
    fi
}

APP_ENV_VAL="${CFG[APP_ENV]:-}"
if [[ "${APP_ENV_VAL,,}" != "production" && "${APP_ENV_VAL,,}" != "prod" ]]; then
    ERRORS+=("APP_ENV wajib 'production' (saat ini: '$APP_ENV_VAL')")
fi

JWT_SEC="${CFG[JWT_SECRET]:-}"
if is_placeholder "$JWT_SEC" || [[ ${#JWT_SEC} -lt 32 ]]; then
    ERRORS+=("JWT_SECRET belum digenerate atau panjangnya < 32 karakter")
else
    JWT_HASH="$(sha256_str "$JWT_SEC")"
    if [[ "$JWT_HASH" == "ce44cdfdb3832af3da3e29ca1e2d8abf0e4d882faa4205dbc8e2888c9b1ab9a0" || \
          "$JWT_HASH" == "7b247fda216a97b4b91649247db133fde5a5e7b9bf0ec6175a81eeeb710a7d91" ]]; then
        ERRORS+=("JWT_SECRET memakai nilai default lama yang telah bocor di riwayat git")
    fi
fi

MFA_KEY="${CFG[MFA_ENCRYPTION_KEY]:-}"
if is_placeholder "$MFA_KEY" || [[ ${#MFA_KEY} -lt 32 ]]; then
    ERRORS+=("MFA_ENCRYPTION_KEY wajib di-set secara eksplisit (>= 32 karakter)")
elif [[ "$MFA_KEY" == "$JWT_SEC" ]]; then
    ERRORS+=("MFA_ENCRYPTION_KEY tidak boleh identik dengan JWT_SECRET")
fi

REQ_SEP="${CFG[REQUIRE_SEPARATE_MFA_KEY]:-}"
if [[ "${REQ_SEP,,}" != "true" ]]; then
    ERRORS+=("REQUIRE_SEPARATE_MFA_KEY wajib diset 'true' di produksi")
fi

MFA_EN="${CFG[MFA_2FA_ENABLED]:-true}"
case "${MFA_EN,,}" in
    true|1|yes|on) ;;
    *) ERRORS+=("MFA_2FA_ENABLED wajib aktif ('true') di produksi") ;;
esac

JWT_HRS="${CFG[JWT_EXPIRATION_HOURS]:-12}"
if [[ ! "$JWT_HRS" =~ ^[0-9]+$ ]] || (( JWT_HRS < 1 || JWT_HRS > 24 )); then
    ERRORS+=("JWT_EXPIRATION_HOURS ($JWT_HRS) wajib bilangan bulat pada rentang 1..24 jam")
fi

DB_SSL="${CFG[DB_SSLMODE]:-}"
case "${DB_SSL,,}" in
    require|verify-ca|verify-full) ;;
    *) ERRORS+=("DB_SSLMODE wajib require/verify-ca/verify-full (saat ini: '$DB_SSL')") ;;
esac

DB_AUTO="${CFG[DB_AUTO_MIGRATE]:-}"
case "${DB_AUTO,,}" in
    false|0|no) ;;
    *) ERRORS+=("DB_AUTO_MIGRATE wajib 'false' di produksi agar GORM AutoMigrate & data demo tidak berjalan tiap boot") ;;
esac

if is_placeholder "${CFG[DB_PASSWORD]:-}"; then
    ERRORS+=("DB_PASSWORD masih berupa placeholder atau kosong")
fi

REDIS_ADDR_VAL="${CFG[REDIS_ADDR]:-}"
if is_placeholder "$REDIS_ADDR_VAL"; then
    ERRORS+=("REDIS_ADDR wajib diisi (misal 127.0.0.1:6379)")
fi

if is_placeholder "${CFG[REDIS_PASSWORD]:-}"; then
    ERRORS+=("REDIS_PASSWORD wajib diisi di produksi (Redis tanpa autentikasi dilarang)")
fi

APP_URL_VAL="${CFG[APP_URL]:-}"
APP_URL_LOW="${APP_URL_VAL,,}"
if [[ "$APP_URL_LOW" != https://* || "$APP_URL_LOW" == *localhost* || "$APP_URL_LOW" == *127.0.0.1* ]]; then
    ERRORS+=("APP_URL produksi wajib memakai domain publik https:// (saat ini: '$APP_URL_VAL')")
fi

ORIGINS_RAW="${CFG[ALLOWED_ORIGINS]:-}"
IFS=',' read -r -a ORIGIN_ARR <<< "$ORIGINS_RAW"
VALID_ORIGIN_COUNT=0
for raw_o in "${ORIGIN_ARR[@]}"; do
    o="${raw_o#"${raw_o%%[![:space:]]*}"}"
    o="${o%"${o##*[![:space:]]}"}"
    [[ -z "$o" ]] && continue
    VALID_ORIGIN_COUNT=$((VALID_ORIGIN_COUNT + 1))
    olow="${o,,}"
    if [[ "$olow" != https://* || "$olow" == *localhost* || "$olow" == *127.0.0.1* || "$olow" == *0.0.0.0* ]]; then
        ERRORS+=("Origin CORS tidak sah untuk produksi: '$o'")
    fi
done
if (( VALID_ORIGIN_COUNT == 0 )); then
    ERRORS+=("ALLOWED_ORIGINS tidak boleh kosong")
fi

if (( ${#ERRORS[@]} > 0 )); then
    echo "[GAGAL] Audit statis .env.production menemukan ${#ERRORS[@]} masalah:" >&2
    idx=1
    for err_msg in "${ERRORS[@]}"; do
        echo "  ${idx}. ${err_msg}" >&2
        idx=$((idx + 1))
    done
    exit 1
fi

echo "[OK] Gate #1: Validasi statis .env.production & pemisahan kunci kriptografis lulus."

if [[ "$SKIP_LIVE_PROBES" == "1" ]]; then
    echo "[INFO] SKIP_LIVE_PROBES=1 aktif; melewati probe langsung ke Redis, PostgreSQL, dan Reverse Proxy."
    exit 0
fi

REDIS_HOST="${REDIS_ADDR_VAL%%:*}"
REDIS_PORT="${REDIS_ADDR_VAL##*:}"
[[ "$REDIS_HOST" == "$REDIS_PORT" ]] && REDIS_PORT="6379"
REDIS_DB="${CFG[REDIS_DB]:-0}"

if ! command -v redis-cli >/dev/null 2>&1; then
    echo "[GAGAL] Gate #2: utilitas redis-cli tidak ditemukan untuk memverifikasi Redis produksi." >&2
    exit 1
fi
PONG_OUT="$(REDISCLI_AUTH="${CFG[REDIS_PASSWORD]}" redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" ping 2>/dev/null || true)"
if [[ "${PONG_OUT%$'\r'}" != "PONG" ]]; then
    echo "[GAGAL] Gate #2: Redis pada $REDIS_HOST:$REDIS_PORT gagal merespons PONG. Ingat: APP_ENV=production menerapkan fail-closed jika Redis mati!" >&2
    exit 1
fi
echo "[OK] Gate #2: Koneksi Redis produksi aktif dan terautentikasi (PONG)."

DB_HOST="${CFG[DB_HOST]:-127.0.0.1}"
DB_PORT="${CFG[DB_PORT]:-5432}"
DB_USER="${CFG[DB_USER]:-postgres}"
DB_NAME="${CFG[DB_NAME]:-catavor}"

if ! command -v psql >/dev/null 2>&1; then
    echo "[GAGAL] Gate #3: utilitas psql tidak ditemukan untuk memverifikasi koneksi TLS PostgreSQL." >&2
    exit 1
fi
PG_PROBE="$(PGPASSWORD="${CFG[DB_PASSWORD]}" PGSSLMODE="${DB_SSL,,}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1;" 2>/dev/null || true)"
if [[ "$(printf '%s' "$PG_PROBE" | tr -d '[:space:]')" != "1" ]]; then
    echo "[GAGAL] Gate #3: Koneksi PostgreSQL dengan sslmode=${DB_SSL,,} ke $DB_HOST:$DB_PORT/$DB_NAME gagal." >&2
    exit 1
fi
echo "[OK] Gate #3: Koneksi PostgreSQL terenkripsi (sslmode=${DB_SSL,,}) berhasil diverifikasi."

if [[ "$PROXY_TYPE" == "nginx" ]]; then
    nginx -t -c "$SCRIPT_DIR/nginx.conf"
    echo "[OK] Gate #4: Konfigurasi Nginx ($SCRIPT_DIR/nginx.conf) valid."
elif [[ "$PROXY_TYPE" == "caddy" ]]; then
    caddy validate --config "$SCRIPT_DIR/Caddyfile"
    echo "[OK] Gate #4: Konfigurasi Caddy ($SCRIPT_DIR/Caddyfile) valid."
fi

echo "[LULUS] Seluruh pemeriksaan Preflight Produksi Catavor berhasil."

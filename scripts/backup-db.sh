#!/usr/bin/env bash
# Backup database Catavor (PostgreSQL) — format custom, terkompresi.
#
# Kenapa skrip, bukan cron langsung ke pg_dump: butuh rotasi retensi, verifikasi
# hasil, dan fail-loud. Backup yang gagal diam-diam lebih buruk daripada tidak
# punya backup, karena memberi rasa aman palsu.
#
# Pemakaian:
#   BACKUP_DIR=/var/backups/catavor ./scripts/backup-db.sh
#
# Env yang dipakai (ambil dari .env backend bila ada):
#   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
#   BACKUP_DIR       (default: ./backups)   tujuan penyimpanan
#   BACKUP_RETAIN    (default: 14)          jumlah file terakhir yang disimpan
#   PGPASSWORD       dipakai pg_dump; diisi dari DB_PASSWORD
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Muat .env backend bila ada (tanpa menimpa env yang sudah diset eksplisit)
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ''|'#'*) continue ;;
    esac
    key="$(echo "$key" | tr -d '[:space:]')"
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < <(grep -E '^[A-Z_]+=' "$PROJECT_ROOT/backend/.env" || true)
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-catavor}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
BACKUP_RETAIN="${BACKUP_RETAIN:-14}"

if [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "GAGAL: pg_dump tidak ditemukan di PATH." >&2
  echo "Install postgresql-client, atau jalankan backup dari host yang punya tool itu." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/catavor-$DB_NAME-$STAMP.dump"

echo "Backup $DB_NAME dari $DB_HOST:$DB_PORT -> $OUT"

# --format=custom: bisa di-restore selektif (pg_restore), terkompresi.
# --no-owner bukan dipakai: kita pertahankan ownership agar restore setia.
if ! pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=9 \
  --file="$OUT"; then
  echo "GAGAL: pg_dump error. Backup TIDAK dibuat." >&2
  rm -f "$OUT"
  exit 1
fi

# Verifikasi: file harus ada dan tidak kosong. Dump kosong = backup palsu.
SIZE="$(wc -c < "$OUT" | tr -d '[:space:]')"
if [ "$SIZE" -lt 1024 ]; then
  echo "GAGAL: hasil backup hanya $SIZE byte — kemungkinan rusak." >&2
  exit 1
fi

# Uji bahwa pg_restore bisa membaca header-nya (bukan cuma file besar).
if command -v pg_restore >/dev/null 2>&1; then
  if ! pg_restore --list "$OUT" >/dev/null 2>&1; then
    echo "GAGAL: pg_restore tidak bisa membaca hasil dump — backup tidak valid." >&2
    exit 1
  fi
fi

echo "OK: $(printf '%s' "$SIZE" | numfmt --to=iec 2>/dev/null || echo "$SIZE byte")"

# Rotasi: simpan BACKUP_RETAIN file terbaru saja.
COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name "catavor-$DB_NAME-*.dump" | wc -l | tr -d '[:space:]')"
if [ "$COUNT" -gt "$BACKUP_RETAIN" ]; then
  find "$BACKUP_DIR" -maxdepth 1 -name "catavor-$DB_NAME-*.dump" \
    | sort | head -n "$((COUNT - BACKUP_RETAIN))" | while read -r old; do
      echo "Hapus backup lama: $(basename "$old")"
      rm -f "$old"
    done
fi

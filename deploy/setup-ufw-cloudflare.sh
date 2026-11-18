#!/usr/bin/env bash
# ==============================================================================
# Catavor Origin Firewall Hardening — UFW Allowlist Resmi Cloudflare (Gate #4)
#
# Mengunci port 80/tcp dan 443/tcp pada host Linux agar HANYA menerima paket dari
# rentang CIDR resmi Cloudflare (IPv4 + IPv6), menolak akses langsung ke port 8000,
# dan mempertahankan akses SSH administrasi agar operator tidak terkunci di luar.
# Bebas ketergantungan python3 (murni Bash + awk).
#
# Contoh penggunaan aman:
#   DRY_RUN=1 ADMIN_SSH_CIDR="203.0.113.10/32" bash deploy/setup-ufw-cloudflare.sh
#   sudo ADMIN_SSH_CIDR="203.0.113.10/32" bash deploy/setup-ufw-cloudflare.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF_CONF="${CF_CONF:-$SCRIPT_DIR/cloudflare-ips.conf}"
SSH_PORT="${SSH_PORT:-22}"
ADMIN_SSH_CIDR="${ADMIN_SSH_CIDR:-}"
DRY_RUN="${DRY_RUN:-0}"
RULE_COMMENT="catavor-cloudflare-edge"

if [[ ! -f "$CF_CONF" ]]; then
    echo "[ABORT] Berkas daftar subnet Cloudflare tidak ditemukan: $CF_CONF" >&2
    exit 1
fi

validate_cidr() {
    local c="$1"
    if [[ "$c" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]{1,2})$ ]]; then
        local pfx="${BASH_REMATCH[2]}"
        (( pfx >= 8 && pfx <= 32 )) && return 0
        return 1
    elif [[ "$c" =~ ^[0-9a-fA-F:]+/([0-9]{1,3})$ ]]; then
        local pfx6="${BASH_REMATCH[1]}"
        (( pfx6 >= 16 && pfx6 <= 128 )) && return 0
        return 1
    fi
    return 1
}

mapfile -t RAW_CIDRS < <(awk '/^[[:space:]]*set_real_ip_from[[:space:]]+/ { gsub(/;/, "", $2); gsub(/\r/, "", $2); print $2 }' "$CF_CONF")
CIDRS=()
for c in "${RAW_CIDRS[@]}"; do
    [[ -z "$c" ]] && continue
    if ! validate_cidr "$c"; then
        echo "[ABORT] Format CIDR tidak valid pada $CF_CONF: '$c'" >&2
        exit 1
    fi
    CIDRS+=("$c")
done

if (( ${#CIDRS[@]} < 17 )); then
    echo "[ABORT] Jumlah total subnet Cloudflare (${#CIDRS[@]}) terlalu sedikit; batalkan demi keamanan." >&2
    exit 1
fi

run_ufw() {
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "[DRY-RUN] ufw $*"
    else
        ufw "$@"
    fi
}

if [[ "$DRY_RUN" != "1" ]] && ! command -v ufw >/dev/null 2>&1; then
    echo "[ABORT] Utilitas ufw tidak ditemukan di sistem ini." >&2
    exit 1
fi

echo "=== [1/4] Mengamankan Akses Administrasi SSH (Port $SSH_PORT/tcp) ==="
if [[ -n "$ADMIN_SSH_CIDR" ]]; then
    if ! validate_cidr "$ADMIN_SSH_CIDR"; then
        echo "[ABORT] Format ADMIN_SSH_CIDR tidak valid: '$ADMIN_SSH_CIDR' (contoh: 203.0.113.10/32)" >&2
        exit 1
    fi
    run_ufw allow proto tcp from "$ADMIN_SSH_CIDR" to any port "$SSH_PORT" comment "catavor-admin-ssh"
else
    echo "[PERINGATAN] ADMIN_SSH_CIDR tidak diset; mengaktifkan rate-limit SSH global pada port $SSH_PORT/tcp agar sesi SSH tidak terputus."
    run_ufw limit "${SSH_PORT}/tcp" comment "catavor-admin-ssh-ratelimited"
fi

echo "=== [2/4] Menutup Akses Publik Langsung ke Port Backend Go (8000/tcp) ==="
run_ufw deny 8000/tcp comment "catavor-deny-direct-backend"

echo "=== [3/4] Menyinkronkan Allowlist Port 80 & 443 Khusus Subnet Cloudflare (${#CIDRS[@]} CIDR) ==="
if [[ "$DRY_RUN" != "1" ]]; then
    mapfile -t OLD_RULES < <(ufw status numbered | grep "$RULE_COMMENT" | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn || true)
    for num in "${OLD_RULES[@]}"; do
        if [[ -n "$num" ]]; then
            ufw --force delete "$num" >/dev/null
        fi
    done
fi

for cidr in "${CIDRS[@]}"; do
    run_ufw allow proto tcp from "$cidr" to any port 80,443 comment "$RULE_COMMENT"
    run_ufw allow proto udp from "$cidr" to any port 443 comment "$RULE_COMMENT"
done

echo "=== [4/4] Memastikan Kebijakan Default Firewall Aktif ==="
run_ufw default deny incoming
run_ufw default allow outgoing
if [[ "$DRY_RUN" == "1" ]]; then
    echo "[OK] DRY_RUN selesai (${#CIDRS[@]} subnet Cloudflare tervalidasi)."
else
    ufw --force enable
    echo "[BERHASIL] Firewall origin UFW Catavor telah dikunci khusus trafik Cloudflare Edge."
fi

#!/usr/bin/env bash
# ==============================================================================
# Sinkronisasi Atomik & Tahan-Gagal Subnet Resmi Cloudflare (Linux/Bash — N-56)
# ==============================================================================
set -euo pipefail

PROXY_TYPE="${PROXY_TYPE:-none}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$SCRIPT_DIR}"
HEALTH_URL="${CATAVOR_HEALTH_URL:-http://127.0.0.1:8000/healthz}"
CF_V4_URL="https://www.cloudflare.com/ips-v4"
CF_V6_URL="https://www.cloudflare.com/ips-v6"

if [[ "$PROXY_TYPE" != "nginx" && "$PROXY_TYPE" != "caddy" && "$PROXY_TYPE" != "none" ]]; then
    echo "[ABORT] PROXY_TYPE tidak valid: '$PROXY_TYPE' (gunakan nginx, caddy, atau none)" >&2
    exit 1
fi

WORK_V4="$(mktemp)"
WORK_V6="$(mktemp)"
PARSED_JSON="$(mktemp)"
cleanup_tmp() {
    rm -f "$WORK_V4" "$WORK_V6" "$PARSED_JSON"
}
trap cleanup_tmp EXIT

if [[ -n "${CF_IPS_V4_FILE:-}" || -n "${CF_IPS_V6_FILE:-}" ]]; then
    if [[ "$PROXY_TYPE" != "none" ]]; then
        echo "[ABORT] Override berkas input lokal hanya diizinkan pada PROXY_TYPE=none." >&2
        exit 1
    fi
    cp "${CF_IPS_V4_FILE}" "$WORK_V4"
    cp "${CF_IPS_V6_FILE}" "$WORK_V6"
else
    curl -fsSL --max-time 15 "$CF_V4_URL" -o "$WORK_V4"
    curl -fsSL --max-time 15 "$CF_V6_URL" -o "$WORK_V6"
fi

# Validasi semantik IP/CIDR dual-stack + strict host-bits zero check + bounds [12..20] & [5..10]
python3 - "$WORK_V4" "$WORK_V6" "$PARSED_JSON" <<'PY'
import ipaddress, json, pathlib, sys

v4_raw = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
v6_raw = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
out_path = pathlib.Path(sys.argv[3])

for content in (v4_raw, v6_raw):
    low = content.lower()
    if "<html" in low or "<!doctype" in low:
        raise SystemExit("Respons terdeteksi berupa HTML/challenge page.")

def parse_cidrs(raw: str, version: int):
    nets = set()
    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        net = ipaddress.ip_network(s, strict=True)  # strict=True menolak host bits non-zero!
        if net.version != version:
            raise SystemExit(f"Keluarga IP salah pada {s}")
        nets.add(str(net))
    return sorted(nets)

v4 = parse_cidrs(v4_raw, 4)
v6 = parse_cidrs(v6_raw, 6)

if not (12 <= len(v4) <= 20):
    raise SystemExit(f"Jumlah subnet IPv4 ({len(v4)}) di luar batas [12..20].")
if not (5 <= len(v6) <= 10):
    raise SystemExit(f"Jumlah subnet IPv6 ({len(v6)}) di luar batas [5..10].")

out_path.write_text(json.dumps({"v4": v4, "v6": v6}), encoding="utf-8")
PY

generate_snippets() {
    local nginx_dst="$1"
    local caddy_dst="$2"
    python3 - "$PARSED_JSON" "$nginx_dst" "$caddy_dst" <<'PY'
import json, pathlib, sys

data = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
v4, v6 = data["v4"], data["v6"]

nginx_lines = [
    "# Auto-generated Cloudflare Trusted Subnets (Nginx)",
    f"# IPv4 ({len(v4)} subnet)",
    *[f"set_real_ip_from {c};" for c in v4],
    "",
    f"# IPv6 ({len(v6)} subnet)",
    *[f"set_real_ip_from {c};" for c in v6],
    "",
    "real_ip_header CF-Connecting-IP;",
    "real_ip_recursive on;",
    "",
]
if sys.argv[2]:
    pathlib.Path(sys.argv[2]).write_text("\n".join(nginx_lines), encoding="utf-8")

if sys.argv[3]:
    joined = " ".join(v4 + v6)
    caddy_txt = (
        "(cloudflare_trusted_proxies) {\n"
        f"\ttrusted_proxies static {joined}\n"
        "\tclient_ip_headers CF-Connecting-IP X-Forwarded-For\n"
        "}\n"
    )
    pathlib.Path(sys.argv[3]).write_text(caddy_txt, encoding="utf-8")
PY
}

if [[ "$PROXY_TYPE" == "none" ]]; then
    mkdir -p "$DEPLOY_DIR/test-output"
    generate_snippets "$DEPLOY_DIR/test-output/cloudflare-ips.test.conf" "$DEPLOY_DIR/test-output/cloudflare-ips.test.caddy"
    echo "[OK] Mode PROXY_TYPE=none selesai di $DEPLOY_DIR/test-output/"
    exit 0
fi

if [[ "$PROXY_TYPE" == "nginx" ]]; then
    TARGET="$DEPLOY_DIR/cloudflare-ips.conf"
    TMP_FILE="$TARGET.tmp"
    BAK_FILE="$TARGET.bak"
    HARNESS="$DEPLOY_DIR/.nginx.harness.tmp.conf"

    generate_snippets "$TMP_FILE" ""
    sed 's/include cloudflare-ips\.conf;/include cloudflare-ips.conf.tmp;/g' "$DEPLOY_DIR/nginx.conf" > "$HARNESS"
    if ! nginx -t -c "$HARNESS"; then
        rm -f "$HARNESS" "$TMP_FILE"
        echo "[ABORT] Validasi nginx -t gagal." >&2
        exit 1
    fi
    rm -f "$HARNESS"

    [[ -f "$TARGET" ]] && cp -f "$TARGET" "$BAK_FILE"
    mv -f "$TMP_FILE" "$TARGET"

    if timeout 10s nginx -s reload && curl -fsS -m 5 "$HEALTH_URL" >/dev/null; then
        rm -f "$BAK_FILE"
        echo "[OK] Nginx Cloudflare IPs berhasil dimutakhirkan."
        exit 0
    fi

    TS="$(date +%s)"
    mv -f "$TARGET" "$TARGET.quarantine.$TS"
    [[ -f "$BAK_FILE" ]] && mv -f "$BAK_FILE" "$TARGET"
    if ! timeout 10s nginx -s reload; then
        echo "CRITICAL: Nginx reload & rollback gagal pada $TS" > "$DEPLOY_DIR/PROXY_CONFIG_ERROR.alert"
        exit 3
    fi
    exit 2
fi

if [[ "$PROXY_TYPE" == "caddy" ]]; then
    TARGET="$DEPLOY_DIR/cloudflare-ips.caddy"
    TMP_FILE="$TARGET.tmp"
    BAK_FILE="$TARGET.bak"
    HARNESS="$DEPLOY_DIR/.Caddyfile.harness.tmp"

    generate_snippets "" "$TMP_FILE"
    sed 's/import cloudflare-ips\.caddy/import cloudflare-ips.caddy.tmp/g' "$DEPLOY_DIR/Caddyfile" > "$HARNESS"
    if ! caddy validate --config "$HARNESS"; then
        rm -f "$HARNESS" "$TMP_FILE"
        echo "[ABORT] Validasi caddy validate gagal." >&2
        exit 1
    fi
    rm -f "$HARNESS"

    [[ -f "$TARGET" ]] && cp -f "$TARGET" "$BAK_FILE"
    mv -f "$TMP_FILE" "$TARGET"

    if timeout 10s caddy reload --config "$DEPLOY_DIR/Caddyfile" && curl -fsS -m 5 "$HEALTH_URL" >/dev/null; then
        rm -f "$BAK_FILE"
        echo "[OK] Caddy Cloudflare IPs berhasil dimutakhirkan."
        exit 0
    fi

    TS="$(date +%s)"
    mv -f "$TARGET" "$TARGET.quarantine.$TS"
    [[ -f "$BAK_FILE" ]] && mv -f "$BAK_FILE" "$TARGET"
    if ! timeout 10s caddy reload --config "$DEPLOY_DIR/Caddyfile"; then
        echo "CRITICAL: Caddy reload & rollback gagal pada $TS" > "$DEPLOY_DIR/PROXY_CONFIG_ERROR.alert"
        exit 3
    fi
    exit 2
fi

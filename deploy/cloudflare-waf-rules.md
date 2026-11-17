# Panduan Standarisasi Infrastruktur Edge Reverse Proxy & Cloudflare WAF (`N-56`)

Dokumen ini merupakan pedoman operasional produksi untuk pengamanan lapisan edge (Cloudflare WAF + Nginx/Caddy Reverse Proxy) di depan layanan Go backend Catavor (`127.0.0.1:8000`).

---

## 1. Pemetaan Kemampuan Tier Resmi Cloudflare Edge WAF

Tabel berikut menyajikan pemetaan faktual berdasarkan dokumentasi kapabilitas paket Cloudflare:

| Fitur Cloudflare Edge WAF | Paket Free | Paket Pro | Paket Business | Paket Enterprise |
| :--- | :---: | :---: | :---: | :---: |
| **DDoS Protection L3 / L4 / L7** | Termasuk | Termasuk | Termasuk | Termasuk |
| **Cloudflare Free Managed Ruleset** | Termasuk | Termasuk | Termasuk | Termasuk |
| **Custom WAF Rules** | 5 aturan | 20 aturan | 100 aturan | 1000+ aturan |
| **Cloudflare Managed Ruleset (CVE & App Protections)** | Tidak tersedia | Termasuk | Termasuk | Termasuk |
| **OWASP Core Security Ruleset** | Tidak tersedia | Termasuk | Termasuk | Termasuk |
| **Bot Management / Anomaly Detection** | Bot Fight Mode dasar | Super Bot Fight Mode | Super Bot Fight Mode | Full Bot Management |

> **Catatan Transparansi:** Daftar 15 subnet IPv4 dan 7 subnet IPv6 pada `deploy/cloudflare-ips.conf` serta `deploy/cloudflare-ips.caddy` bersumber dari publikasi resmi Cloudflare (`https://www.cloudflare.com/ips-v4` & `https://www.cloudflare.com/ips-v6`). Untuk pembaruan otomatis di server produksi, jalankan skrip `deploy/update-cloudflare-ips.sh` (Linux) atau `deploy/update-cloudflare-ips.ps1` (Windows).

---

## 2. Arsitektur Enkripsi TLS: Wajib Mode `Full (Strict)`

1. Pada konsol Cloudflare **SSL/TLS -> Overview**, setel mode enkripsi ke **Full (Strict)**.
   - **DILARANG** menggunakan mode *Flexible* (trafik Cloudflare ke origin tidak terenkripsi) maupun *Full* non-strict (rentan terhadap sertifikat self-signed palsu / MITM).
2. Terbitkan **Cloudflare Origin CA Certificate** (ECDSA P-256, masa berlaku hingga 15 tahun) untuk `catavor.com` dan `*.catavor.com`, lalu simpan pada host origin dengan izin ketat:
   - Sertifikat publik: `/etc/ssl/catavor/origin-cert.pem` (`0644`)
   - Kunci privat: `/etc/ssl/catavor/origin-key.pem` (`0600`, milik `root`)
3. Aktifkan **Always Use HTTPS**, **Minimum TLS Version: TLS 1.2**, dan **HSTS**:
   - `max-age=63072000` (24 bulan), `includeSubDomains`, `preload` (hanya diaktifkan setelah seluruh subdomain terverifikasi melayani HTTPS murni).

---

## 3. Isolasi Jaringan Origin Server (*Origin Firewall Isolation*)

Pemeriksaan header HTTP di Nginx/Caddy **bukan** pengganti isolasi level jaringan. Agar penyerang tidak dapat mem-bypass Cloudflare WAF dan menyerang IP publik origin secara langsung:

1. **Backend Go hanya mengikat loopback lokal** (`127.0.0.1:8000`), tidak pernah diekspos ke `0.0.0.0:8000` di internet publik.
2. **Firewall Host Origin (Linux UFW / Cloud Security Group)** wajib menolak seluruh koneksi masuk TCP port `80` dan `443` dari luar subnet resmi Cloudflare:

```bash
ufw default deny incoming
ufw default allow outgoing

# Izinkan SSH hanya dari bastion / VPN manajemen
ufw allow from <MANAGEMENT_BASTION_CIDR> to any port 22 proto tcp

# Izinkan HTTP/HTTPS eksklusif dari 15 IPv4 + 7 IPv6 resmi Cloudflare
for cidr in $(grep -E '^set_real_ip_from ' deploy/cloudflare-ips.conf | awk '{print $2}' | tr -d ';'); do
    ufw allow from "$cidr" to any port 443 proto tcp
    ufw allow from "$cidr" to any port 80 proto tcp
done

ufw enable
```

3. **Defense-in-Depth Authenticated Origin Pulls (mTLS) / Origin Header:**
   Aktifkan **Authenticated Origin Pulls** di Cloudflare atau sisipkan header rahasia lewat Cloudflare Transform Rule dan cocokkan pada `deploy/nginx.conf`.

---

## 4. Rekomendasi Custom WAF Rules (Kompatibel sejak Paket Free — 5 Slot)

1. **Rule 1 — Proteksi Endpoint Autentikasi, OTP & MFA dari Otomasi Mencurigakan**
   - Ekspresi: `(http.request.uri.path eq "/api/login" or starts_with(http.request.uri.path, "/api/auth/")) and (cf.threat_score gt 14)`
   - Aksi: `Managed Challenge`
2. **Rule 2 — Proteksi Konsol Admin Platform (`/admin` & `/api/admin/*`)**
   - Ekspresi: `(http.request.uri.path eq "/admin" or starts_with(http.request.uri.path, "/api/admin/")) and not ip.geoip.country in {"ID"}` *(sesuaikan dengan negara domisili tim operasional)*
   - Aksi: `Managed Challenge`
3. **Rule 3 — Blokir Pemindai Kerentanan Umum & Path Sensitif Non-Aplikasi**
   - Ekspresi: `(http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git" or http.request.uri.path contains "/wp-admin" or http.request.uri.path contains "phpmyadmin")`
   - Aksi: `Block`
4. **Rule 4 — Pembatasan Metode HTTP Non-Standar**
   - Ekspresi: `not http.request.method in {"GET" "POST" "PUT" "PATCH" "DELETE" "HEAD" "OPTIONS"}`
   - Aksi: `Block`
5. **Rule 5 — Proteksi Penyalahgunaan Payload Besar di Luar Rute Upload**
   - Ekspresi: `(http.request.body.size gt 2097152) and not (starts_with(http.request.uri.path, "/api/products") or starts_with(http.request.uri.path, "/api/stores") or starts_with(http.request.uri.path, "/api/support") or starts_with(http.request.uri.path, "/api/subscription"))`
   - Aksi: `Block`

---

## 5. Prosedur Validasi Sintaks & Pembaruan Otomatis Subnet Cloudflare

### Validasi Manual Konfigurasi Proxy
- **Nginx:**
  ```bash
  nginx -t -c /opt/catavor/deploy/nginx.conf
  ```
- **Caddy:**
  ```bash
  caddy validate --config /opt/catavor/deploy/Caddyfile
  ```

### Pembaruan Otomatis Subnet Cloudflare (Cron Mingguan)
Skrip `deploy/update-cloudflare-ips.sh` dan `deploy/update-cloudflare-ips.ps1` menerapkan pengaman berlapis:
- Validasi semantik CIDR dual-stack + pemeriksaan ketat bit host bernilai nol (`strict=True` / bitmask check).
- Pemeriksaan batas jumlah subnet ($12 \le \text{IPv4} \le 20$ dan $5 \le \text{IPv6} \le 10$) serta deduplikasi.
- Penulisan berkas `.tmp` di direktori yang sama, validasi sintaks target proxy sebelum swap, backup `.bak`, reload ber-timeout `10s`, smoke test `/healthz` ber-timeout `5s`, auto-rollback (`exit 2`), dan karantina aman `PROXY_CONFIG_ERROR.alert` (`exit 3`).
- Mode uji terisolasi tanpa menyentuh sistem aktif:
  ```bash
  PROXY_TYPE=none ./deploy/update-cloudflare-ips.sh
  ```
  atau di PowerShell:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\update-cloudflare-ips.ps1 -ProxyType none
  ```

# Mitigasi M1 (Opsi A) — Masa Hidup Token & Deteksi Anomali Sesi

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md`
**Status**: ✅ SELESAI & TERVERIFIKASI RUNTIME
**Catatan**: Ini **mitigasi**, bukan perbaikan penuh. M1 (JWT di localStorage)
tetap terbuka secara arsitektur.

---

## Kenapa mitigasi, bukan migrasi penuh

Migrasi ke httpOnly cookie membutuhkan:
- Mengubah **60 titik baca token** + **19 titik set** di 12 file (desktop + mobile)
- Membuat **CSRF middleware dari nol** (saat ini tidak ada)
- Mengubah **4 titik SSE** (`?token=` tidak bisa dipakai bila token di cookie httpOnly)
- Pengujian menyeluruh untuk 4 peran (superadmin, merchant, staf, customer)

Estimasi 1–2 hari kerja berisiko tinggi. Manfaatnya juga sudah sebagian tertutup
oleh pekerjaan sebelumnya:
- **M2 (CSP ketat)** memutus eksekusi script suntikan → jalur utama pencurian token
- **L2 (sanitizer allowlist)** menutup vektor stored-XSS
- **M4** memastikan tidak ada kebocoran error yang membantu penyerang

Mitigasi ini memberi sebagian manfaat dengan risiko hampir nol.

---

## Perubahan 1 — Masa hidup token 72 jam → 12 jam

**File**: `backend/internal/config/config.go`, `backend/.env`

Sebelumnya token berlaku **72 jam (3 hari)**. Token yang dicuri lewat XSS bisa
dipakai selama itu.

Sekarang:
- Default `JWT_EXPIRATION_HOURS` = **12**
- Nilai `<= 0` dianggap tidak valid → jatuh ke 12
- **Production/staging + nilai > 24 jam → `log.Fatal()`** (menolak start)
- Local/dev + > 24 jam → hanya WARN

Aman dari sisi UX karena frontend sudah punya `handleUnauthorized()` yang
menangani 401 dengan redirect ke login dan pesan jelas.

---

## Perubahan 2 — Deteksi anomali sesi (IP + User-Agent)

**File baru**: `backend/internal/middleware/session_fingerprint.go`

Cara kerja:
1. Saat **login**, dicatat sidik jari = `sha256(ip|user-agent)` dengan key `jti`
   (ID unik token), TTL 24 jam, disimpan di memori + dibersihkan berkala
2. Setiap request terautentikasi membandingkan sidik jari saat ini dengan yang
   tercatat
3. Bila **berbeda** → dicatat `WARN` berisi `user_id`, `jti`, `ip`, `path`,
   `ua_prefix` — **tidak memblokir**
4. Saat **logout** → sidik jari dihapus

**Kenapa tidak memblokir**: pengguna mobile sering berpindah jaringan
(seluler ↔ WiFi). Memblokir akan memaksa logout di tengah pekerjaan — masalah UX
nyata dengan manfaat keamanan yang kecil (penyerang bisa memalsukan UA, dan
banyak pengguna sah berbagi IP publik/NAT).

**Privasi**: hanya hash SHA-256 yang disimpan, bukan IP/UA mentah, dan hanya di
memori (hilang saat restart).

Sambungan:
- `auth_handler.go` → `RegisterSessionFingerprint()` setelah login sukses
- `middleware/auth.go` → `CheckSessionFingerprint()` pada setiap request
- `auth_handler.go` → `RevokeSessionFingerprint()` saat logout

---

## Verifikasi runtime

| Uji | Hasil |
|---|---|
| Umur token yang diterbitkan | **12 jam** (dulu 72) ✅ |
| Login normal | HTTP 200 ✅ |
| Token valid diterima | HTTP 200 ✅ |
| Token dipakai dari UA berbeda | tetap 200 (**by design**) ✅ |
| Anomali tercatat di log | **4 entri `WRN SESI ANOMALI`** ✅ |
| Logout | HTTP 200 ✅ |
| Token setelah logout | HTTP 401 (ditolak) ✅ |
| Prod + `JWT_EXPIRATION_HOURS=72` | **FATAL, menolak start** ✅ |
| `go build ./...` / `go vet` | exit 0 ✅ |

Contoh log anomali nyata:
```
WRN SESI ANOMALI: token dipakai dari IP/User-Agent berbeda dari saat login.
    Bila bukan pengguna sah, token kemungkinan dicuri — pertimbangkan revoke sesi.
    ip= jti=b6fd688b-d9b6-473e-a91d-ed1d751037ac path=/api/auth/verify
    ua_prefix=ADHOC-UA-HIJACK/9.9 user_id=5
```

---

## Dampak operasional

1. **Pengguna akan diminta login ulang lebih sering** (tiap 12 jam, bukan 72).
   Untuk merchant yang bekerja seharian, ini wajar; bila terasa mengganggu,
   naikkan ke 24 (batas maksimum di production).
2. **Log `SESI ANOMALI` perlu dipantau.** Tanpa monitoring, deteksi ini tidak
   berguna. Rekomendasi: alert bila muncul > N kali untuk `user_id` yang sama
   dalam 1 jam.
3. **Tidak menyelesaikan M1.** Token masih bisa dibaca JS bila XSS berhasil
   (meski jalurnya kini jauh lebih sempit karena CSP + sanitizer).

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| H1, H2 | HIGH | ✅ FIXED |
| M2, M3, M4 | MED | ✅ FIXED |
| L1–L6 | LOW | ✅ FIXED |
| **M1** | JWT di localStorage | 🟡 **DIMITIGASI** (masa hidup 12 jam + deteksi anomali) |

**11 dari 12 tertutup penuh; M1 diturunkan risikonya secara signifikan.**

---

## Langkah berikutnya (bila ingin menutup M1 sepenuhnya)

Rencana migrasi ke httpOnly cookie, diperkirakan 1–2 hari:

1. Backend: set cookie `HttpOnly; Secure; SameSite=Strict` saat login; endpoint
   logout menghapusnya
2. Backend: tambah **CSRF double-submit token** (wajib, karena cookie terkirim
   otomatis)
3. Backend: SSE mengambil token dari cookie, bukan query string
4. Frontend: hapus 60 titik `getItem('catavor_token')`; `fetch` pakai
   `credentials: 'include'`
5. Uji semua peran + alur OAuth Google + mobile

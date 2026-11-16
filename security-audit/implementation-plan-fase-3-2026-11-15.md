# Implementation Plan — Remediasi Temuan Audit Keamanan Fase 3 (Privasi Log PII, Kebijakan Password Produk Catavor & Sliding Session)

**Tanggal Penyusunan:** 15 November 2026
**Status Riwayat Dokumen Plan (15 Nov 2026):** ✅ **REVISI PLAN DISETUJUI HISTORIS — LULUS AUDIT ULANG SOPYANA AGENT (`REV-R3-01` s.d. `REV-R3-10` TERTUNTASKAN 100%, 0 BLOCKER)**
**Referensi Audit & Kolaborasi:**
- `security-audit/audit-putaran-8-zero-change-2026-11-14.md` (Temuan `N-53`, `N-54`, `N-55`)
- `security-audit/implementation-plan-putaran-8-2026-11-14.md` (Roadmap Induk Fase 3, baris 308–350)
- `security-audit/catatan-verifikasi-eksekusi-fase2-2026-11-15.md` (Hasil Audit Independen Fase 2: Lulus Penuh 0 Blocker, 0 Regresi)
- `security-audit/catatan-review-plan-fase3-2026-11-15.md` (Putusan Akhir Sopyana Agent Putaran 2: **`LULUS / APPROVED`** + 6 Catatan Presisi Implementasi Kode di Bagian 5)
**Baseline Commit:** `8181ddd` (`feat(security): remediate Fase 2 findings (N-48, N-49)`)
**Status Eksekusi Historis (15 Nov 2026):** 🟢 **LULUS / APPROVED UNTUK DRAF RENCANA KERJA (PLAN) — DIIZINKAN MELANGKAH KE EKSEKUSI KODE PADA PUTARAN 2**
**Status Terkini Dokumen & Implementasi (16 Nov 2026):** 🟡 **KODE TERVERIFIKASI TEKNIS SECARA LOKAL — KEPUTUSAN FINAL MENUNGGU PEMILIK PROYEK (Lihat `catatan-review-plan-fase3-2026-11-15.md` Bagian 11)**

---

## 1. Ringkasan Eksekutif & Ruang Lingkup Fase 3

Fase 3 berfokus pada **tiga pilar keamanan utama**:
1. **`N-53` [LOW] — Masking PII (Email & Nama) pada Seluruh Log Server Standar**:
   Mencegah kebocoran data pribadi (Personally Identifiable Information / PII) ke `stdout`, file log, atau log aggregator pihak ketiga (Datadog, Loki, CloudWatch) tanpa memutus jejak forensik database `activity_logs` bagi Superadmin.
2. **`N-54` [LOW] — Kebijakan Password Modern (Prinsip NIST SP 800-63B & Kebijakan Produk Catavor)**:
   Mengadopsi prinsip utama NIST SP 800-63B Section 5.1.1.2 (menghapus pemaksaan komposisi karakter kaku pada *passphrase* panjang $\ge 15$ karakter, menyaring kata sandi populer/bocor (*common breached passwords*) dengan normalisasi *leetspeak*), dikombinasikan dengan kebijakan internal produk Catavor (batas minimum 10 karakter dan variasi karakter untuk 10–14 karakter) serta batas teknis algoritma bcrypt 72 byte UTF-8 (`bcrypt.ErrPasswordTooLong`), yang diselaraskan di backend dan ketiga frontend (`desktop`, `mobile`, `tablet`).
3. **`N-55` [LOW] — Silent Sliding Session & Arsitektur Sinkronisasi Token 3-Layer**:
   Menerapkan perpanjangan sesi otomatis (*sliding session rotation*) pada middleware backend saat token cookie aktif memasuki jendela paruh umur ($\ge 50\%$ masa aktif), dilengkapi arsitektur sinkronisasi token 3-layer (Header respons `X-Refreshed-Token` + fallback single-flight refresh di 3 SPA + fallback cookie backend), sinkronisasi tabel database `user_sessions`, pengikatan *session fingerprint* (UA/IP), *cooldown lock* Redis anti-race burst multi-tab, serta penegakan batas absolut masa sesi 7 hari (*absolute session timeout*).

### 1.1 Matriks Ruang Lingkup & Pemetaan Temuan Revisi Reviewer

| Kode Temuan | Severity | Referensi Review | Lokasi File Aktual | Target Remediasi Komprehensif |
| :--- | :---: | :---: | :--- | :--- |
| **N-53** | 🟡 **LOW** | `REV-R3-01`<br>`REV-R3-09` | `backend/internal/logutil/mask.go` *(File Baru)*<br>`backend/internal/logutil/mask_test.go` *(File Baru)*<br>`backend/internal/database/redis.go`<br>`backend/internal/services/otp_service.go`<br>`backend/internal/services/email_queue_service.go`<br>`backend/internal/services/mailer.go`<br>`backend/internal/services/dormancy_service.go`<br>`backend/internal/handlers/payment_handler.go`<br>`backend/internal/handlers/client_log_handler.go`<br>`backend/internal/database/db.go` | Buat leaf package `logutil` bebas dependensi internal. Terapkan `MaskEmail` dengan penanganan UTF-8 rune safe (`[]rune(local)`) anti karakter `\ufffd`. Terapkan masking pada **11 titik log server** (termasuk 5 titik di `email_queue_service`, `dormancy_service`, webhook payment snippet, dan client log redaction). Dokumentasikan pengecualian legal `db.go:860` (seed lokal). |
| **N-54** | 🟡 **LOW** | `REV-R3-06`<br>`REV-R3-07`<br>`REV-R3-08` | `backend/internal/security/sanitizer.go`<br>`backend/internal/security/sanitizer_behavior_test.go`<br>`backend/internal/services/rbac_service.go`<br>`backend/cmd/admin-cli/main.go`<br>`backend/internal/handlers/rbac_handler_test.go`<br>`frontend/desktop/src/App.tsx`<br>`frontend/mobile/src/App.tsx`<br>`frontend/tablet/src/components/TabletMerchantAdmin.tsx`<br>`frontend/*/src/components/AdminRBACManagement.tsx` | Modernisasi `ValidatePassword`: min 10 karakter, maks 72 byte UTF-8, anti-repetitive, blacklist leetspeak, passphrase kalimat $\ge 15$ karakter bebas simbol. Tutup celah bypass di `RBACService.CreateStaffUser` dan `admin-cli`. Update test `sanitizer_behavior_test.go` & fixtures. Selaraskan seluruh form di **ketiga bundel SPA** (`desktop`, `mobile`, `tablet` + `AdminRBACManagement.tsx`). |
| **N-55** | 🟡 **LOW** | `REV-R3-02`<br>`REV-R3-03`<br>`REV-R3-04`<br>`REV-R3-05` | `backend/internal/middleware/session_cookie.go` *(File Baru)*<br>`backend/internal/handlers/session_cookie.go`<br>`backend/internal/middleware/auth.go`<br>`backend/internal/middleware/auth_test.go`<br>`backend/internal/middleware/security.go`<br>`backend/internal/services/session_service.go`<br>`backend/internal/handlers/auth_handler.go`<br>`backend/internal/handlers/store_handler.go`<br>`backend/internal/database/redis.go`<br>`backend/internal/database/redis_test.go`<br>`frontend/desktop/src/App.tsx`<br>`frontend/mobile/src/App.tsx`<br>`frontend/tablet/src/App.tsx`<br>`frontend/tablet/src/utils/auth.ts` | Pindahkan fungsi cookie ke `middleware/session_cookie.go` (anti import cycle). Pasang sliding session di `AuthRequired` dengan `X-Refreshed-Token` header + CORS ExposeHeaders. Pasang interseptor & single-flight refresh fallback di 3 SPA. Update atomik `user_sessions` via `RotateUserSessionToken` dan `session_fingerprint`. Pasang Redis lock `SETNX` (cooldown 60s) & grace period 30s di `RefreshToken`. Tegakkan `AbsoluteExpiresAt` 7 hari di `RefreshToken` dan `SwitchStore`. |

### 1.2 Batasan Ketat & Jaminan Zero-Regression (Guardrails)

1. **JANGAN Menjalankan Eksekusi Sebelum Disetujui:**
   Dokumen ini disiapkan murni untuk tahap *design review*. Tidak ada baris kode atau pengujian yang diubah sebelum ada persetujuan resmi dari reviewer independen.
2. **Server Live di Port 8000 Wajib Tetap Hidup:**
   Background daemon server di port 8000 (`/healthz` 200 OK) tidak boleh dihentikan, di-restart sembarangan, atau diganggu jalannya.
3. **Bebas Migrasi Skema Database (`Zero Schema Change`):**
   Tidak ada penambahan tabel atau perubahan DDL kolom pada database (`DB_AUTO_MIGRATE=false`, `SKIP_DB_MIGRATE=true`). Sesi database yang sudah ada (`models.UserSession`) digunakan secara langsung.
4. **Mandat Tri-Frontend Parity across Form-Factors:**
   Perubahan logika validasi password, penanganan token, dan interseptor `authFetch` wajib diterapkan secara simetris di ketiga bundel: `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile`.
5. **Haram Unit Test Statis Berbasis Teks:**
   Dilarang keras menggunakan `os.ReadFile` + `strings.Contains`. Seluruh unit test wajib menguji runtime logika fungsi, masking, parsing password NIST, dan flow rotasi token via `app.Test` / DB uji.
6. **Verifikasi Dist Multi-Target via Node 22 (fnm):**
   Hasil kompilasi frontend wajib di-build ke direktori `public/{desktop,mobile,tablet}` menggunakan Node 22 via `fnm`.

---

## 2. Spesifikasi Teknis Terperinci per Paket Remediasi

---

### 2.1 [N-53 — LOW] Penyamaran PII (Email & Nama) pada Log Server Standar

#### A. Analisis Masalah & Kebutuhan Forensik:
1. **Risiko Kebocoran PII di Log Terbuka:**
   Penulisan log `zerolog` ke `stdout` atau file mencetak email pelanggan/merchant secara telanjang. Ini bertentangan dengan prinsip privasi data (UU PDP / GDPR).
2. **Kebutuhan Investigasi vs Jejak Audit:**
   Log aplikasi operasional hanya memerlukan korelasi akun dan domain email (apakah bouncing atau salah domain). Jejak audit legal lengkap (*forensic trail*) tetap tersimpan aman di tabel database `activity_logs` yang hanya dapat diakses oleh Superadmin melalui portal terenkripsi.
3. **Pemberesan Batas Dependensi Paket (Mengakomodasi `REV-R3-01`):**
   Paket `internal/database` mengimpor `internal/models` dan `internal/config`. Menaruh fungsi masking di `internal/security` dan mengimpornya dari `internal/database/redis.go` berisiko memicu *import cycle* di masa depan bila layer `security` memerlukan layer `database`.
   **Solusi:** Buat leaf package terisolasi `backend/internal/logutil/mask.go` (package `logutil`) yang murni mengimpor paket bawaan Go (`strings`, `unicode/utf8`), tanpa dependensi internal aplikasi apa pun.

#### B. Spesifikasi Implementasi `backend/internal/logutil/mask.go`:

```go
package logutil

import (
	"strings"
	"unicode/utf8"
)

// MaskEmail menyamarkan alamat email untuk kebutuhan logging aplikasi (N-53 / UU PDP).
// Format penyamaran aman berbasis UTF-8 rune:
//   - "dzikri@catavor.id"   -> "dz***i@catavor.id"
//   - "john@example.com"    -> "jo***n@example.com"
//   - "dan@domain.com"     -> "d*n@domain.com"
//   - "id@domain.com"      -> "i*@domain.com"
//   - "a@domain.com"       -> "*@domain.com"
//   - "" / format invalid  -> "***"
func MaskEmail(email string) string {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return "***"
	}

	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "***"
	}

	user := parts[0]
	domain := parts[1]
	runes := []rune(user)
	runeLen := len(runes)

	var maskedUser string
	switch {
	case runeLen == 0:
		maskedUser = "***"
	case runeLen == 1:
		maskedUser = "*"
	case runeLen == 2:
		maskedUser = string(runes[0]) + "*"
	case runeLen == 3:
		maskedUser = string(runes[0]) + "*" + string(runes[2])
	default:
		// Ambil 2 rune pertama dan 1 rune terakhir (UTF-8 safe)
		maskedUser = string(runes[0:2]) + "***" + string(runes[runeLen-1:])
	}

	return maskedUser + "@" + domain
}

// MaskName menyamarkan nama pengguna untuk logging (misal "Budi Santoso" -> "B***o").
func MaskName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "***"
	}
	runes := []rune(trimmed)
	runeLen := len(runes)
	if runeLen <= 2 {
		return string(runes[0]) + "*"
	}
	return string(runes[0]) + "***" + string(runes[runeLen-1])
}

// SanitizeLogSnippet membatasi panjang teks dan mereduksi pola sensitif pada log mentah.
func SanitizeLogSnippet(input string, maxLen int) string {
	trimmed := strings.TrimSpace(input)
	if len(trimmed) > maxLen {
		trimmed = trimmed[:maxLen] + "..."
	}
	// Hindari membuang baris baru atau karakter kontrol liar
	return strings.ReplaceAll(trimmed, "\n", " ")
}
```

> [!NOTE]
> **Koreksi Implementasi Rune-Safe (Menggantikan Pseudocode di Atas):**
> Snippet `SanitizeLogSnippet` di atas merupakan draf rancangan awal berbasis pemotongan byte (`trimmed[:maxLen]`). Pada implementasi aktual di `backend/internal/logutil/mask.go:66-73`, pemotongan telah disempurnakan menjadi berbasis UTF-8 rune (`runes := []rune(trimmed); string(runes[:maxLen]) + "..."`) guna mencegah pemotongan karakter multibyte di tengah byte sequence.

#### C. Pemetaan Titik Log Server yang Diselaraskan (Mengakomodasi `REV-R3-01` & `REV-R3-09`):

> [!NOTE]
> **Rekonsiliasi Hitungan Titik Masking PII:**
> Pemetaan 5 file di bawah mencakup **12 log statement (event)** dan **13 pemanggilan fungsi `logutil.Mask*`** di `backend/internal/` (12 pemanggilan `logutil.MaskEmail` dan 1 pemanggilan `logutil.MaskName` pada `dormancy_service.go:515-516`), ditambah 2 titik sanitasi muatan/telemetri pada handler (`payment_handler.go:62` untuk body snippet dan `client_log_handler.go:48` untuk redaksi log klien). Angka "11 titik" pada teks historis awal merujuk pada jumlah call site di 4 file awal sebelum penyertaan masking nama pada `dormancy_service.go`.

1. **`backend/internal/database/redis.go:445`**:
   ```go
   log.Error().Str("email", logutil.MaskEmail(cleaned)).Msg("M3: Redis tidak tersedia di production — menolak login (fail closed)")
   ```
2. **`backend/internal/services/otp_service.go:184 & 265`**:
   ```go
   log.Info().Str("email", logutil.MaskEmail(cleanedEmail)).Str("type", otpType).Msg("Mengirimkan kode verifikasi email")
   log.Error().Err(res.Error).Str("email", logutil.MaskEmail(cleanedEmail)).Msg("Gagal menyimpan data token verifikasi")
   ```
3. **`backend/internal/services/email_queue_service.go` (LENGKAP 5 TITIK)**:
   - Baris 45: `log.Warn().Str("to", logutil.MaskEmail(recipientEmail)).Msg("Antrean email penuh; mengirim langsung via fallback sinkron")`
   - Baris 60: `log.Warn().Str("to", logutil.MaskEmail(recipientEmail)).Msg("Email duplikat terdeteksi dalam jendela cooldown; skip")`
   - Baris 88: `log.Error().Err(err).Str("to", logutil.MaskEmail(recipientEmail)).Msg("Gagal mengirim email transaksi")`
   - Baris 96: `log.Info().Str("to", logutil.MaskEmail(recipientEmail)).Msg("Email transaksi berhasil dimasukkan ke antrean")`
   - Baris 175: `log.Info().Str("to", logutil.MaskEmail(job.RecipientEmail)).Msg("Worker email berhasil mengirim pesan")`
4. **`backend/internal/services/mailer.go:120, 134, 138`**:
   ```go
   log.Info().Str("to", logutil.MaskEmail(toEmail)).Msg("Mengirim email via SMTP...")
   ```
5. **`backend/internal/services/dormancy_service.go:514–515`**:
   ```go
   log.Info().
       Str("store_id", store.ID).
       Str("user_email", logutil.MaskEmail(userEmail)).
       Str("user_name", logutil.MaskName(userName)).
       Msg("Hard purge toko inaktif berhasil diselesaikan")
   ```
6. **`backend/internal/handlers/payment_handler.go:61`**:
   ```go
   log.Error().
       Err(err).
       Str("body_snippet", logutil.SanitizeLogSnippet(string(rawBody), 256)).
       Msg("Gagal unmarshal payload webhook pembayaran")
   ```
7. **`backend/internal/handlers/client_log_handler.go:77, 83, 95`**:
   Sebelum memasukkan string `page_url`, `err_message`, dan `stack` ke `zerolog`, lakukan redaksi regex ringan untuk pola token (`Bearer [A-Za-z0-9-_.]+` $\rightarrow$ `Bearer [REDACTED]`) dan pola alamat email (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` $\rightarrow$ `[MASKED_EMAIL]`).
8. **Pengecualian Sengaja yang Didokumentasikan:**
   `backend/internal/database/db.go:860` mencetak `admin@catavor.local` saat bootstrap inisialisasi database kosong pertama kali. Ini adalah akun pengembang lokal bawaan (bukan PII pengguna nyata), sehingga sah dibiarkan apa adanya.

#### D. Pengujian Runtime Paket `N-53`:
- Buat `backend/internal/logutil/mask_test.go`:
  - Kasus standar: `budi.santoso@gmail.com` $\rightarrow$ `bu***o@gmail.com`.
  - Kasus 4 karakter: `john@example.com` $\rightarrow$ `jo***n@example.com`.
  - Kasus 3 karakter: `dan@domain.com` $\rightarrow$ `d*n@domain.com`.
  - Kasus 2 karakter: `id@domain.com` $\rightarrow$ `i*@domain.com`.
  - Kasus 1 karakter: `a@domain.com` $\rightarrow$ `*@domain.com`.
  - Kasus UTF-8 multi-byte (RFC 6531): `ユーザー@domain.com` $\rightarrow$ `ユー***ー@domain.com` (0 byte rusak `\ufffd`).
  - Kasus email invalid/kosong: `""`, `"bukan-email"`, `"@domain.com"`, `"user@"` $\rightarrow$ `"***"`.
  - Kasus `MaskName` dan `SanitizeLogSnippet`.

---

### 2.2 [N-54 — LOW] Kebijakan Password Produk Catavor (Defense-in-Depth & Prinsip NIST)

#### A. Analisis Masalah & Perbandingan dengan Standar Resmi:
1. **Kelemahan Aturan Kompleksitas Kaku Tradisional:**
   Aturan lama mewajibkan minimal 8 karakter dengan 4 kelas karakter wajib (huruf besar, huruf kecil, angka, simbol).
   - *False Positive:* Menolak passphrase kalimat yang sangat kuat dan mudah diingat seperti `kucing berlari di taman kota` (28 karakter) hanya karena tidak memiliki angka/simbol.
   - *False Negative:* Menerima kata sandi pasaran yang mudah ditebak seperti `Password123!` atau `Admin2026@`.
2. **Perbandingan Persyaratan Resmi NIST SP 800-63B Revision 4 vs Kebijakan Produk Catavor:**
   - **Standar Resmi NIST SP 800-63B Revision 4 Final (Section 3.1.1.2 Memorized Secret):**
     - *Single-Factor Memorized Secret:* Wajib memiliki panjang sekurang-kurangnya **15 karakter** apabila kata sandi berfungsi sebagai faktor otentikasi tunggal.
     - *Multi-Factor Memorized Secret:* Boleh memiliki panjang sekurang-kurangnya **8 karakter** hanya apabila kata sandi digunakan sebagai salah satu faktor dalam skema MFA.
     - *Aturan Komposisi Karakter:* Verifier **SHALL NOT** (dilarang) memaksakan aturan komposisi karakter (misalnya kewajiban campuran huruf besar/kecil/angka/simbol) karena terbukti mendorong substitusi yang mudah ditebak.
     - *Rotasi Berkala:* Verifier **SHALL NOT** (dilarang) mewajibkan penggantian kata sandi berkala tanpa adanya bukti kompromi.
     - *Penyaringan Kredensial Bocor:* Verifier **SHALL** memeriksa kata sandi terhadap daftar kata sandi yang telah terkompromi (*compromised/breached credentials*).
   - **Kebijakan Internal Produk Catavor (Defense-in-Depth):**
     - *Batas Minimum 10 Karakter:* Kebijakan internal produk Catavor. Dalam konteks otentikasi faktor tunggal (tanpa MFA wajib), angka 10 karakter ini berada di bawah rekomendasi 15 karakter NIST SP 800-63B Rev 4.
     - *Batas Maksimum 72 Byte UTF-8:* Batasan teknis arsitektur akibat limit pemotongan internal algoritma hashing `bcrypt` (`bcrypt.GenerateFromPassword`), bukan batasan standar NIST.
     - *Kombinasi Karakter untuk 10–14 Karakter:* Kebijakan pertahanan berlapis internal Catavor (wajib kombinasi huruf + angka/simbol) untuk memitigasi brute-force pada kata sandi yang relatif pendek. Aturan ini merupakan penyimpangan/penambahan defensif internal produk Catavor dan bukan mandat NIST (NIST justru melarang pemaksaan komposisi).
     - *Passphrase Panjang ($\ge 15$ Karakter):* Menerapkan filosofi modern dengan membebaskan sepenuhnya dari kewajiban simbol/angka kaku.
     - *Penyaringan Breached Password & Leetspeak:* Menerapkan prinsip penyaringan NIST secara parsial melalui kamus lokal statis (40+ variasi kata sandi umum) dan normalisasi *leetspeak*.
   - **Kesimpulan Kepatuhan:** Kebijakan kata sandi Catavor adalah **Kebijakan Keamanan Internal Produk Catavor**, bukan konformitas penuh terhadap spesifikasi resmi NIST SP 800-63B Revision 4.
3. **Konsistensi Spasi & Byte bcrypt (Mengakomodasi `REV-R3-08`):**
   `models/user.go:32` meng-hash byte mentah kata sandi tanpa `strings.TrimSpace`. Oleh karena itu:
   - Validasi memastikan `strings.TrimSpace(pwd) != ""` agar kata sandi bukan sekadar spasi kosong.
   - Perhitungan panjang karakter (rune) dan ukuran byte (72 byte) dihitung dari string kata sandi asli agar spasi di dalam passphrase kalimat tetap dihitung proporsional.
   - Pesan error batas atas: *"Kata sandi melewati batas maksimum sistem (maksimal 72 karakter/byte)."*

#### B. Spesifikasi Implementasi Backend:

1. **Logika `ValidatePassword` di `backend/internal/security/sanitizer.go`:**

```go
var commonBreachedPasswords = map[string]struct{}{
	"password":       {},
	"passwords":      {},
	"password123":    {},
	"password1234":   {},
	"admin123":       {},
	"admin1234":      {},
	"administrator":  {},
	"catavor":        {},
	"catavor123":     {},
	"dfauna":         {},
	"dfauna123":      {},
	"qwerty":         {},
	"qwertyuiop":     {},
	"12345678":       {},
	"123456789":      {},
	"1234567890":     {},
	"letmein123":     {},
	"welcome123":     {},
	"indonesia":      {},
	"indonesia123":   {},
	"rahasia123":     {},
	"iloveyou123":    {},
	"sunshine123":    {},
}

func normalizeLeetspeak(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range strings.ToLower(s) {
		switch r {
		case '@', '4':
			b.WriteRune('a')
		case '0':
			b.WriteRune('o')
		case '1', '!', '|':
			b.WriteRune('i')
		case '3':
			b.WriteRune('e')
		case '$', '5':
			b.WriteRune('s')
		case '7':
			b.WriteRune('t')
		default:
			if unicode.IsLetter(r) || unicode.IsDigit(r) {
				b.WriteRune(r)
			}
		}
	}
	return b.String()
}

func isCommonBreachedPassword(pw string) bool {
	lower := strings.ToLower(pw)
	if _, exists := commonBreachedPasswords[lower]; exists {
		return true
	}
	normalized := normalizeLeetspeak(pw)
	if _, exists := commonBreachedPasswords[normalized]; exists {
		return true
	}
	for common := range commonBreachedPasswords {
		if len(common) >= 6 && strings.Contains(normalized, common) {
			return true
		}
	}
	return false
}

func isAllSameRune(s string) bool {
	runes := []rune(s)
	if len(runes) == 0 {
		return true
	}
	first := runes[0]
	for _, r := range runes[1:] {
		if r != first {
			return false
		}
	}
	return true
}

// ValidatePassword menegakkan kebijakan kata sandi Catavor (kombinasi prinsip NIST SP 800-63B & aturan internal produk) (N-54).
func ValidatePassword(password string) error {
	trimmed := strings.TrimSpace(password)
	if trimmed == "" {
		return errors.New("Kata sandi tidak boleh kosong.")
	}

	runeLen := utf8.RuneCountInString(password)
	if runeLen < 10 {
		return errors.New("Kata sandi minimal 10 karakter.")
	}
	if len([]byte(password)) > 72 {
		return errors.New("Kata sandi melewati batas maksimum sistem (maksimal 72 karakter/byte).")
	}

	if isAllSameRune(password) {
		return errors.New("Kata sandi tidak boleh hanya berupa karakter berulang.")
	}

	if isCommonBreachedPassword(password) {
		return errors.New("Kata sandi terlalu umum atau mudah ditebak. Silakan gunakan kombinasi kata sandi lain.")
	}

	// NIST Passphrase Rule: kata sandi panjang (>= 15 karakter) bebas dari kewajiban simbol/angka
	if runeLen >= 15 {
		return nil
	}

	// Kata sandi pendek (10 - 14 karakter) membutuhkan variasi karakter
	var hasLetter, hasNumberOrSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsNumber(r) || unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasNumberOrSpecial = true
		}
	}

	if !hasLetter || !hasNumberOrSpecial {
		return errors.New("Kata sandi 10-14 karakter harus mengombinasikan huruf dengan angka atau simbol.")
	}

	return nil
}
```

2. **Penutupan Celah Bypass Backend (Mengakomodasi `REV-R3-07`):**
   - **`backend/internal/services/rbac_service.go:402`**:
     Ganti:
     ```go
     if len(password) < 8 {
         return nil, errors.New("kata sandi awal minimal 8 karakter")
     }
     ```
     Menjadi:
     ```go
     if err := security.ValidatePassword(password); err != nil {
         return nil, err
     }
     ```
   - **`backend/cmd/admin-cli/main.go:60–75, 108`**:
     Tambahkan validasi resmi sebelum membuat akun superadmin:
     ```go
     if err := security.ValidatePassword(password); err != nil {
         log.Fatalf("Kata sandi tidak valid: %v", err)
     }
     ```

3. **Sinkronisasi Lengkap di Ketiga Frontend SPA (Mengakomodasi `REV-R3-06`):**
   Hapus seluruh pemaksaan regex 4 kelas karakter, naikkan batas minimal dari 8 ke 10 karakter, batas maksimal 72 byte UTF-8 via `new TextEncoder().encode(pwd).length <= 72`, dan perbarui placeholder/teks bantuan pada:
   - **`frontend/desktop/src/App.tsx`**:
     - Baris `5453–5455`: Registrasi merchant (`validateStep1`: min 10 karakter, max 72 byte).
     - Baris `12692–12694`: Reset forgot password (min 10 karakter).
     - Baris `13347–13376`: Form backup password (hapus 4 regex kaku, min 10 karakter).
     - Baris `13478–13507`: Form ubah password via OTP profil (hapus 4 regex kaku, min 10 karakter).
     - Baris `24849–24857`: Indikator checklist visual syarat password (min 10 karakter, maks 72 karakter/byte, hindari kata sandi umum).
     - Baris `25070`, `25255`, `32683`: `placeholder="Minimal 10 karakter"`.
   - **`frontend/mobile/src/App.tsx`**:
     - Baris `5614–5616`: Registrasi merchant (min 10 karakter).
     - Baris `13524–13553`: Ubah password (hapus 4 regex kaku, min 10 karakter).
     - Baris `19204`, `36518`: `placeholder="Minimal 10 karakter"` (termasuk forgot password & OTP profil).
   - **`frontend/tablet/src/components/TabletMerchantAdmin.tsx`**:
     - Baris `3378–3407`: Ubah password (hapus 4 regex kaku, min 10 karakter).
     - Baris `11130–11135`: Indikator checklist visual syarat password.
     - Baris `11311`, `11477`: `placeholder="Minimal 10 karakter"`.
   - **`AdminRBACManagement.tsx` di Ketiga Bundel**:
     - `frontend/desktop/src/components/AdminRBACManagement.tsx:281-283, 1965, 2002`
     - `frontend/mobile/src/components/AdminRBACManagement.tsx:360-362, 1771`
     - `frontend/tablet/src/components/AdminRBACManagement.tsx:297-299, 1876`

#### C. Pengujian Runtime Paket `N-54` (Mengakomodasi `REV-R3-08`):
- Perbarui `backend/internal/security/sanitizer_behavior_test.go:328-354` (`TestValidatePassword`):
  - Passphrase kalimat panjang tanpa angka/simbol (`"kucing berlari di taman kota"`) $\rightarrow$ LULUS.
  - Password 10–14 karakter dengan kombinasi huruf dan angka (`"KucingLari99"`) $\rightarrow$ LULUS.
  - Kata sandi bocor (`"Password123!"`, `"P@ssw0rd123!"`, `"admin12345"`, `"qwertyuiop"`) $\rightarrow$ DITOLAK.
  - Kata sandi berulang (`"aaaaaaaaaa"`, `"1111111111"`) $\rightarrow$ DITOLAK.
  - Kata sandi $< 10$ karakter $\rightarrow$ DITOLAK.
  - Kata sandi $> 72$ byte UTF-8 $\rightarrow$ DITOLAK.
- Pastikan fixture di `backend/internal/handlers/rbac_handler_test.go:337` memenuhi kriteria $\ge 10$ karakter dan tidak masuk daftar blocklist.

---

### 2.3 [N-55 — LOW] Silent Sliding Session Rotation & Sinkronisasi Token 3-Layer

#### A. Analisis Masalah Kritis Runtime / Desinkronisasi SPA (Mengakomodasi `REV-R3-02`):
1. **Kegagalan Total Pendekatan "Cookie Saja":**
   Di ketiga SPA saat ini, `authFetch` dan `checkTokenValidity` mengecek kedaluwarsa token di 35 titik menggunakan `isTokenExpired(localStorage.getItem('catavor_token'))`.
   - Jika backend hanya memperbarui cookie `catavor_session` (`HttpOnly`), nilai token di `localStorage` tetap memegang `exp` awal 24 jam.
   - Tepat setelah 24 jam, klien melempar user keluar (`handleUnauthorized('Sesi Anda telah berakhir')`), membuat user ter-logout paksa padahal cookie sesi di backend masih hidup!
   - Di sisi backend (`middleware/auth.go:237-253`), header `Authorization: Bearer <token>` diprioritaskan sebelum cookie. Jika token lokal kedaluwarsa tetap dikirim, backend menolak `401 TOKEN_EXPIRED` dan mengabaikan cookie!
2. **Solusi Komprehensif Arsitektur Sinkronisasi 3-Layer:**
   - **Layer 1 (Backend Response Header & JSON Payload):**
     Setiap kali sliding session dirotasi, selain memperbarui cookie `catavor_session`, backend menyisipkan response header `X-Refreshed-Token: <newToken>`. Header ini diekspos ke browser melalui CORS `ExposeHeaders` di `security.go`. Respons `/api/auth/verify` dan `/api/auth/refresh` juga menyertakan token baru pada JSON body.
   - **Layer 2 (Client Interceptor & Single-Flight Refresh di 3 SPA):**
     Wrapper `authFetch` memeriksa header `X-Refreshed-Token`. Jika ditemukan, `localStorage`, state React, dan tab lain via `authSync` langsung diperbarui secara transparan. Pada saat pre-flight `isTokenExpired` mendeteksi token lokal habis, SPA melakukan pemanggilan tunggal (*single-flight*) ke `POST /api/auth/refresh` dengan `credentials: 'include'` untuk mengambil token baru dari cookie yang masih aktif sebelum memutuskan logout.
   - **Layer 3 (Backend Cookie Fallback):**
     Di `middleware/auth.go`, bila header `Authorization: Bearer` kedaluwarsa namun cookie `catavor_session` masih valid dan belum kedaluwarsa, backend beralih memvalidasi token cookie alih-alih langsung menolak 401.

#### B. Spesifikasi Teknis Arsitektur Remediasi:

1. **Pengelolaan Cookie di Paket Middleware (`backend/internal/middleware/session_cookie.go` - File Baru):**
   Untuk mencegah *import cycle* (`handlers -> middleware -> handlers` dilarang oleh Go), helper cookie dipusatkan di layer `middleware`:
   ```go
   package middleware

   import (
       "time"
       "catavor-backend/internal/config"
       "github.com/gofiber/fiber/v2"
   )

   const SessionCookieName = "catavor_session"

   func sessionCookieMaxAge(cfg *config.Config) time.Duration {
       hours := cfg.JWTExpirationHours
       if hours <= 0 || hours > 24 {
           hours = 24
       }
       return time.Duration(hours) * time.Hour
   }

   func isSecureEnv(cfg *config.Config) bool {
       switch cfg.AppEnv {
       case "production", "prod", "staging":
           return true
       default:
           return false
       }
   }

   func SetSessionCookie(c *fiber.Ctx, cfg *config.Config, token string) {
       if token == "" {
           return
       }
       c.Cookie(&fiber.Cookie{
           Name:     SessionCookieName,
           Value:    token,
           Path:     "/",
           MaxAge:   int(sessionCookieMaxAge(cfg).Seconds()),
           Expires:  time.Now().Add(sessionCookieMaxAge(cfg)),
           HTTPOnly: true,
           Secure:   isSecureEnv(cfg),
           SameSite: fiber.CookieSameSiteLaxMode,
       })
   }

   func ClearSessionCookie(c *fiber.Ctx, cfg *config.Config) {
       c.Cookie(&fiber.Cookie{
           Name:     SessionCookieName,
           Value:    "",
           Path:     "/",
           MaxAge:   -1,
           Expires:  time.Now().Add(-time.Hour),
           HTTPOnly: true,
           Secure:   isSecureEnv(cfg),
           SameSite: fiber.CookieSameSiteLaxMode,
       })
   }
   ```
   Di `backend/internal/handlers/session_cookie.go`, fungsi `setSessionCookie` dan `clearSessionCookie` didelegasikan ke `middleware.SetSessionCookie` dan `middleware.ClearSessionCookie`.

   > [!NOTE]
   > **Koreksi Kontrak SameSite (Superseeded by POLISH-R3-05):**
   > Snippet pseudocode di atas menuliskan `SameSite: fiber.CookieSameSiteLaxMode`. Sesuai instruksi audit `POLISH-R3-05` dan implementasi kode aktual pada `backend/internal/middleware/session_cookie.go:44,58` serta pengujian kontrak di `backend/internal/handlers/session_cookie_test.go:48`, kontrak yang aktif diterapkan di sistem adalah **`SameSite: fiber.CookieSameSiteStrictMode` (`SameSite=Strict`)**.

2. **Eksposur Header CORS di `backend/internal/middleware/security.go`:**
   Tambahkan `X-Refreshed-Token` ke dalam daftar `ExposeHeaders` pada konfigurasi CORS agar SPA dapat membaca token baru lintas-origin jika diperlukan.

3. **Sinkronisasi Database `user_sessions` & Session Fingerprint (Mengakomodasi `REV-R3-03`):**
   - Tambahkan fungsi atomik di `backend/internal/services/session_service.go`:
     ```go
     // RotateUserSessionToken memperbarui token_id, expires_at, dan last_active_at pada models.UserSession
     func RotateUserSessionToken(db *gorm.DB, oldTokenID, newTokenID string, newExpiresAt time.Time, ip string) error {
         if db == nil || oldTokenID == "" || newTokenID == "" {
             return nil
         }
         return db.Model(&models.UserSession{}).
             Where("token_id = ? AND is_revoked = ?", oldTokenID, false).
             Updates(map[string]interface{}{
                 "token_id":       newTokenID,
                 "expires_at":     newExpiresAt,
                 "last_active_at": time.Now(),
                 "last_ip":        ip,
             }).Error
     }
     ```
   - Di `middleware/auth.go`, saat rotasi token berhasil, segera panggil `services.RotateUserSessionToken` dan panggil `RegisterSessionFingerprint(newJTI, c.IP(), c.Get("User-Agent"))` agar pengikatan IP/UA tetap konsisten dan penanda *"Perangkat Ini"* di `/api/user/sessions` tidak hilang.

     > [!NOTE]
     > **Koreksi Signature Helper (Superseeded by POLISH-R3-03):**
     > Pseudocode draf awal mencantumkan signature `RegisterSessionFingerprint(newJTI, c, remainingTTL)`. Pada kode aktual di `backend/internal/middleware/session_fingerprint.go:50`, fungsi didefinisikan dengan signature `func RegisterSessionFingerprint(jti, ip, ua string)` dan dipanggil di `middleware/auth.go` dengan `RegisterSessionFingerprint(newJTI, c.IP(), c.Get("User-Agent"))`.

4. **Mitigasi Race Condition Burst Multi-Tab & Grace Period (Mengakomodasi `REV-R3-04`):**
   - **Distributed Cooldown Lock di `middleware/auth.go`:**
     Sebelum memproses rotasi sliding untuk `claims.ID` lama, pasang lock:
     ```go
     lockKey := "sec:slide_lock:" + claims.ID
     if database.IsRedisAvailable() {
         acquired, _ := database.RedisClient.SetNX(ctx, lockKey, 1, 60*time.Second).Result()
         if !acquired {
             // Request paralel lain sudah/sedang melakukan rotasi untuk token ini; lanjutkan request tanpa rotasi ganda
             return c.Next()
         }
     }
     ```
   - **Grace Period Blacklist di `backend/internal/database/redis.go`:**
     Tambahkan `BlacklistTokenWithGracePeriod(jti string, gracePeriod time.Duration, ttl time.Duration)`.
     - Pada `AuthHandler.RefreshToken` (`auth_handler.go:1582`), gunakan grace period 30 detik agar request yang sedang berjalan (*in-flight*) di tab lain tidak langsung terputus 401.
     - Pada `Logout` (`POST /api/auth/logout`) dan pencabutan sesi di `session_handler.go`, tetap gunakan blacklist instan (0 grace period) demi integritas keamanan mutlak.

5. **Penegakan Batas Absolut 7 Hari & Perbaikan `SwitchStore` (Mengakomodasi `REV-R3-05`):**
   - Di `AuthHandler.RefreshToken` (`auth_handler.go:1565–1660`):
     ```go
     if !claims.AbsoluteExpiresAt.IsZero() && time.Now().After(claims.AbsoluteExpiresAt) {
         return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
             "code":    "SESSION_ABSOLUTE_EXPIRED",
             "message": "Sesi telah mencapai batas maksimum (7 hari). Silakan login kembali.",
         })
     }
     ```
   - Di `StoreHandler.SwitchStore` (`store_handler.go:2096–2145`):
     - Ambil klaim sesi aktif dari `c.Locals("claims")`.
     - Teruskan `claims.AbsoluteExpiresAt` ke pembuatan token baru (jangan di-reset ke 7 hari baru).
     - Panggil `middleware.SetSessionCookie(c, cfg, newToken)`.
     - Panggil `services.RotateUserSessionToken` dan `middleware.RegisterSessionFingerprint(newTokenID, c.IP(), c.Get("User-Agent"))`.

6. **Interseptor Klien di 3 SPA (`desktop`, `mobile`, `tablet`):**
   - Pada `authFetch` di `desktop/src/App.tsx`, `mobile/src/App.tsx`, dan `tablet/src/utils/auth.ts`:
     ```typescript
     // Tangkap token baru dari response header
     const refreshedToken = res.headers.get('X-Refreshed-Token');
     if (refreshedToken) {
         localStorage.setItem('catavor_token', refreshedToken);
         authSync.broadcastAuthChange(refreshedToken);
     }
     ```
   - Pada `checkTokenValidity` / pre-flight `authFetch`: jika `isTokenExpired(token)` bernilai `true`, lakukan deduplikasi pemanggilan single-flight ke `POST /api/auth/refresh` dengan `credentials: 'include'`. Jika berhasil `200`, simpan token baru dan lanjutkan request. Jika gagal `401`, barulah picu `handleUnauthorized`.

#### C. Pengujian Runtime Paket `N-55`:
- `backend/internal/database/redis_test.go`:
  - `TestBlacklistTokenWithGracePeriod`: verifikasi token masih valid pada $t = 50\text{ms}$ dan terblokir pada $t = 250\text{ms}$.
- `backend/internal/middleware/auth_test.go`:
  - `TestSlidingSession_RotationAndHeader`: token dengan sisa masa aktif $< 12$ jam memicu penerbitan `Set-Cookie` baru dan header `X-Refreshed-Token`.
  - `TestSlidingSession_AbsoluteTimeout`: token dengan `AbsoluteExpiresAt` masa lalu ditolak `401`.
  - `TestSlidingSession_ConcurrencyLock`: burst 10 request paralel hanya menghasilkan 1x eksekusi rotasi.

---

## 3. Matriks Perubahan Berkas Lengkap

| Path Berkas | Tipe Operasi | Keterangan & Tujuan |
| :--- | :---: | :--- |
| `backend/internal/logutil/mask.go` | **File Baru** | Leaf package helper `MaskEmail`, `MaskName`, `SanitizeLogSnippet` berbasis UTF-8 rune safe (anti import cycle). |
| `backend/internal/logutil/mask_test.go` | **File Baru** | Unit test runtime masking email ASCII, UTF-8 rune, invalid format, nama, dan log snippet. |
| `backend/internal/database/redis.go` | Modifikasi | Terapkan `logutil.MaskEmail`, tambahkan `BlacklistTokenWithGracePeriod`, dan perbarui `IsTokenBlacklisted`. |
| `backend/internal/database/redis_test.go` | Modifikasi / Tambah | Unit test runtime grace period blacklist vs expired. |
| `backend/internal/services/otp_service.go` | Modifikasi | Bungkus penulisan log email dengan `logutil.MaskEmail`. |
| `backend/internal/services/email_queue_service.go` | Modifikasi | Bungkus seluruh 5 titik penulisan log `to` dengan `logutil.MaskEmail`. |
| `backend/internal/services/mailer.go` | Modifikasi | Bungkus penulisan log `to` dengan `logutil.MaskEmail`. |
| `backend/internal/services/dormancy_service.go` | Modifikasi | Bungkus log `user_email` dengan `logutil.MaskEmail` dan `user_name` dengan `logutil.MaskName`. |
| `backend/internal/handlers/payment_handler.go` | Modifikasi | Batasi payload webhook logging dengan `logutil.SanitizeLogSnippet` (maks 256 karakter). |
| `backend/internal/handlers/client_log_handler.go` | Modifikasi | Redaksi regex ringan pada log browser untuk email dan token sebelum masuk `zerolog`. |
| `backend/internal/security/sanitizer.go` | Modifikasi | Modernisasi `ValidatePassword` sesuai NIST SP 800-63B, daftar `commonBreachedPasswords`, leetspeak normalizer. |
| `backend/internal/security/sanitizer_behavior_test.go` | Modifikasi | Perbarui `TestValidatePassword` untuk standar NIST (min 10 karakter, passphrase panjang, leetspeak, 72 byte). |
| `backend/internal/services/rbac_service.go` | Modifikasi | Ganti bypass `len(password) < 8` dengan `security.ValidatePassword(password)`. |
| `backend/cmd/admin-cli/main.go` | Modifikasi | Panggil `security.ValidatePassword(password)` sebelum menyimpan akun admin. |
| `backend/internal/handlers/rbac_handler_test.go` | Modifikasi | Pastikan fixture password uji memenuhi kriteria $\ge 10$ karakter dan bukan kata sandi pasaran. |
| `backend/internal/middleware/session_cookie.go` | **File Baru** | Pusat fungsi `SetSessionCookie` dan `ClearSessionCookie` di layer middleware. |
| `backend/internal/handlers/session_cookie.go` | Modifikasi | Delegasikan fungsi cookie ke `middleware.SetSessionCookie` / `ClearSessionCookie`. |
| `backend/internal/middleware/security.go` | Modifikasi | Tambahkan `X-Refreshed-Token` ke CORS `ExposeHeaders`. |
| `backend/internal/services/session_service.go` | Modifikasi | Tambahkan fungsi atomik `RotateUserSessionToken`. |
| `backend/internal/middleware/auth.go` | Modifikasi | Pasang rotasi sliding session di `AuthRequired`, Redis cooldown lock, cookie fallback, dan register fingerprint. |
| `backend/internal/middleware/auth_test.go` | Modifikasi / Tambah | Unit test runtime sliding session rotation, header `X-Refreshed-Token`, dan batas absolut. |
| `backend/internal/handlers/auth_handler.go` | Modifikasi | Tegakkan penolakan `AbsoluteExpiresAt` di `RefreshToken`, dan gunakan grace period 30 detik pada token lama. |
| `backend/internal/handlers/store_handler.go` | Modifikasi | Di `SwitchStore`, wariskan `AbsoluteExpiresAt`, panggil `SetSessionCookie`, update `user_sessions`, dan register fingerprint. |
| `frontend/desktop/src/App.tsx` | Modifikasi | Selaraskan validasi password NIST di 4 form, checklist visual, placeholder, serta interseptor token di `authFetch`. |
| `frontend/mobile/src/App.tsx` | Modifikasi | Selaraskan validasi password NIST di registrasi, ubah password, placeholder, serta interseptor token di `authFetch`. |
| `frontend/tablet/src/components/TabletMerchantAdmin.tsx` | Modifikasi | Selaraskan validasi password NIST, checklist visual, placeholder di form admin tablet. |
| `frontend/tablet/src/utils/auth.ts` | Modifikasi | Tambahkan penanganan header `X-Refreshed-Token` pada `authFetch` tablet. |
| `frontend/*/src/components/AdminRBACManagement.tsx` | Modifikasi | Selaraskan validasi password staf admin di ketiga bundel (`desktop`, `mobile`, `tablet`). |

---

## 4. Urutan Langkah Eksekusi Berjenjang (Setelah Persetujuan Reviewer)

1. **Tahap 1: Leaf Package Masking PII & Log Sanitization (`N-53`)**
   - Buat `backend/internal/logutil/mask.go` dan `backend/internal/logutil/mask_test.go`.
   - Jalankan `go test -v ./internal/logutil` sampai lulus 100%.
   - Pasang `logutil.MaskEmail`, `logutil.MaskName`, dan sanitasi pada `redis.go`, `otp_service.go`, `email_queue_service.go` (5 titik), `mailer.go`, `dormancy_service.go`, `payment_handler.go`, dan `client_log_handler.go`.
   - Jalankan `go test -v ./internal/services` dan `go test -v ./internal/handlers`.
2. **Tahap 2: Modernisasi Standar Password NIST Backend & Penutupan Bypass (`N-54`)**
   - Perbarui `ValidatePassword`, `commonBreachedPasswords`, dan leetspeak di `sanitizer.go`.
   - Perbarui unit test di `sanitizer_behavior_test.go`.
   - Tutup bypass di `rbac_service.go` dan `cmd/admin-cli/main.go`.
   - Jalankan `go test -v ./internal/security` dan `go test -v ./internal/services`.
3. **Tahap 3: Implementasi Sliding Session, Grace Period & Session Sync Backend (`N-55`)**
   - Buat `backend/internal/middleware/session_cookie.go` dan delegasikan di `handlers/session_cookie.go`.
   - Tambahkan `BlacklistTokenWithGracePeriod` di `redis.go` dan uji via `redis_test.go`.
   - Tambahkan `RotateUserSessionToken` di `services/session_service.go`.
   - Pasang logika sliding rotation, Redis lock cooldown, header `X-Refreshed-Token`, dan fallback cookie di `middleware/auth.go`.
   - Perbarui penegakan `AbsoluteExpiresAt` di `auth_handler.go` (`RefreshToken`) dan `store_handler.go` (`SwitchStore`).
   - Jalankan `go test -v ./internal/middleware` dan `go test -v ./internal/handlers`.
4. **Tahap 4: Penyelarasan Frontend di Ketiga Bundel (`desktop`, `mobile`, `tablet`)**
   - Selaraskan validasi password NIST di form registrasi, forgot password, ubah password, dan checklist visual di `desktop/src/App.tsx`, `mobile/src/App.tsx`, dan `tablet/src/components/TabletMerchantAdmin.tsx`.
   - Selaraskan `AdminRBACManagement.tsx` di ketiga bundel.
   - Pasang interseptor header `X-Refreshed-Token` dan fallback refresh di `authFetch` ketiga bundel.
5. **Tahap 5: Kompilasi & Build Dist Multi-Target via Node 22 (fnm)**
   - Jalankan `fnm use 22` (atau `fnm exec --using=22`).
   - Jalankan `npm run build` di `frontend/desktop` $\rightarrow$ output ke `public/desktop`.
   - Jalankan `npm run build` di `frontend/tablet` $\rightarrow$ output ke `public/tablet`.
   - Jalankan `npm run build` di `frontend/mobile` $\rightarrow$ output ke `public/mobile`.
   - Pastikan ketiga build menghasilkan 0 error TypeScript dan 0 warning kritis.
6. **Tahap 6: Verifikasi Menyeluruh & Uji Kerentanan**
   - Jalankan `GOTOOLCHAIN=auto go test -p 1 -count=1 ./...` pada seluruh paket backend.
   - Jalankan `govulncheck ./...`.
   - Jalankan audit grep otomatis atas seluruh pemanggilan log email di backend.
   - Jalankan pengujian Playwright E2E dengan variabel lingkungan kredensial lengkap.
   - Verifikasi kesehatan daemon live server di port 8000 (`/healthz` = 200).

---

## 5. Checklist Verifikasi Akhir (Definition of Done Fase 3)

- [ ] `GOTOOLCHAIN=auto go test -p 1 -count=1 ./...` seluruh paket backend lulus 100% tanpa kegagalan.
- [ ] `govulncheck ./...` menghasilkan 0 kerentanan terdeteksi.
- [ ] Audit grep atas `.Str("email"`, `.Str("to"`, dan `.Str("user_email"` di `backend/internal/` membuktikan 100% dibungkus `logutil.MaskEmail` (kecuali seed lokal `db.go:860`).
- [ ] Password kalimat panjang ($\ge 15$ karakter) diterima tanpa kewajiban simbol/angka kaku (Filosofi NIST SP 800-63B & Kebijakan Produk Catavor).
- [ ] Password pasaran/bocor (`Password123!`, `P@ssw0rd123!`, `admin123`, dll.) tertolak dengan pesan informatif.
- [ ] Kata sandi berulang (`aaaaaaaaaa`) tertolak.
- [ ] `RBACService.CreateStaffUser` dan `cmd/admin-cli/main.go` menegakkan validasi `ValidatePassword`.
- [ ] Sesi aktif berumur $\ge 50\%$ secara otomatis memperbarui cookie sesi `catavor_session` dan header `X-Refreshed-Token`.
- [ ] Interseptor `authFetch` di ketiga frontend berhasil menyinkronkan token baru ke `localStorage` dan tab lain via `authSync`.
- [ ] Baris database `user_sessions` ter-update atomik saat rotasi sehingga daftar perangkat aktif (`GET /api/user/sessions`) tetap presisi.
- [ ] *Session fingerprint* (UA/IP) tetap aktif melindungi `jti` baru setelah sliding session terjadi.
- [ ] Sesi yang melewati batas absolut 7 hari ditolak `401 SESSION_ABSOLUTE_EXPIRED` (termasuk via refresh token dan ganti toko).
- [ ] Ganti toko (`SwitchStore`) memperbarui cookie sesi dan mewarisi batas absolut sesi tanpa reset 7 hari baru.
- [ ] Bebas dari *import cycle* antara paket `handlers`, `middleware`, `database`, dan `logutil`.
- [ ] Build produksi ketiga frontend (`desktop`, `tablet`, `mobile`) via Node 22 (`fnm`) sukses 0 error dan direktori `public/` ter-update.
- [ ] Server live di port 8000 tetap aktif dan sehat (`/healthz` = 200).
- [ ] Seluruh suite Playwright E2E lulus dengan variabel lingkungan kredensial terpasang.

---

> **Pernyataan Historis Otorisasi Eksekusi Dokumen Plan (Pasca-Audit Ulang Putaran 2, 15 Nov 2026):**
> *(Catatan Historis: Pernyataan di bawah merupakan persetujuan atas dokumen perencanaan kerja / plan sebelum kode diimplementasikan. Untuk status terkini hasil audit implementasi kode dan peninjauan dokumentasi per 16 Nov 2026, lihat `catatan-review-plan-fase3-2026-11-15.md` Bagian 11: KODE TERVERIFIKASI TEKNIS SECARA LOKAL — MENUNGGU KEPUTUSAN PEMILIK PROYEK).*
> Dokumen rencana kerja ini pada tanggal 15 November 2026 telah diverifikasi oleh **Sopyana Agent (Reviewer Independen)** (`catatan-review-plan-fase3-2026-11-15.md` Bagian 5) dengan status historis **`LULUS / APPROVED (PLAN) — SIAP EKSEKUSI KODE`** dengan kewajiban mematuhi **6 Catatan Presisi Implementasi (`POLISH-R3-01` s.d. `POLISH-R3-06`)** yang tercantum di Bagian 5 `catatan-review-plan-fase3-2026-11-15.md`.

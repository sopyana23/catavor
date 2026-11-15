# Catatan Review Independen (Putaran 2) — Implementation Plan Fase 2 [REVISI FINAL]

**Tanggal Review Ulang:** 15 November 2026  
**Dokumen yang Direview:** `security-audit/implementation-plan-fase-2-2026-11-15.md` (Revisi Pasca-Review)  
**Baseline Commit:** `b0517bc`  
**Status Verdict Akhir:** ✅ **LULUS REVIEW & SIAP DIEKSEKUSI OLEH AGENT PELAKSANA (0 BLOCKER)**

---

## 1. Verifikasi Penyelesaian Temuan Putaran 1

Seluruh **2 Blocker** dan **4 Koreksi Arsitektur** dari review putaran pertama telah diintegrasikan secara utuh dan benar di dalam `implementation-plan-fase-2-2026-11-15.md`:

| Item Review Putaran 1 | Status di Plan Revisi | Verifikasi Teknis pada Plan Revisi |
|---|---|---|
| **BLOCKER-1** (Socket/Goroutine Leak `&http.Transport{}` per-request) | ✅ **TERTUNTASKAN** | Singleton `safeAulaaHTTPClient` level paket (baris 203) dengan pool terbatas (`MaxIdleConns: 50`, `MaxIdleConnsPerHost: 10`, `IdleConnTimeout: 90s`, `TLSHandshakeTimeout: 10s`), `isAulaaLocalHTTPAllowed()` dievaluasi dinamis di dalam `DialContext` (baris 154), dan pembacaan response dibatasi `io.LimitReader(resp.Body, 2MB)` (baris 208, 224). |
| **BLOCKER-2** (Anti-OOM `memoryFiberStorage` & Kontrak `fiber.Storage`) | ✅ **TERTUNTASKAN** | `sweepLocked` periodik tiap `30s` / ambang `10.000` entri + hard cap `50.000` entri (baris 289–344), kepatuhan kontrak `key == ""` & `len(val) == 0` (baris 305, 321, 357), serta penanganan error `pipe.Exec(ctx)` di `Reset()` (baris 473). |
| **KOREKSI-3** (CIDR Khusus `0.0.0.1`/NAT64 + Multi-IP Failover + HTTPS Guard) | ✅ **TERTUNTASKAN** | Tabel `disallowedIPNets` mencakup `0.0.0.0/8`, `100.64.0.0/10`, `192.0.0.0/24`, `198.18.0.0/15`, `240.0.0.0/4`, `255.255.255.255/32`, `64:ff9b::/96`, `64:ff9b:1::/48` (baris 73–82); tolakan total atas dual-record poisoning + sequential failover pada `safeIPs` (baris 167–188); `validateAulaaBaseURLScheme` ditegakkan pre-request (baris 210–222). |
| **KOREKSI-4** (Kejujuran Atomisitas Fiber `FixedWindow` + Throttled Warn Log) | ✅ **TERTUNTASKAN** | Didokumentasikan jernih (baris 233–238) + `logRedisStorageDegraded` ber-throttle CAS `atomic.Int64` 30 detik (baris 378–389). |
| **KOREKSI-5** (Injectable Resolver TOCTOU Test + Multi-Instance 2-Replica Test + `-race`) | ✅ **TERTUNTASKAN** | `newSafeAulaaHTTPClientWithResolver` + test TOCTOU, dual-record poisoning, failover multi-IP (baris 530–545), serta `TestDistributedRateLimiter_MultiInstance` 2 instance `*fiber.App` di atas `miniredis` + wajib `go test -race -count=1 ./...` (baris 562–566, 599). |
| **KOREKSI-6** (Verifikasi `auth_handler.go:1419`) | ✅ **TERKONFIRMASI** | Tepat dinyatakan out-of-scope karena URL Google OAuth hardcoded konstan. |

---

## 2. Tiga Catatan Implementasi Kecil (*Implementation Polish* Saat Menulis Kode, Bukan Penghalang Plan)

Saat agent pelaksana mulai menulis kode Go dari snippet di plan, perhatikan 3 detail implementasi kecil berikut agar `go test -race ./...` langsung hijau pada percobaan pertama:

1. **Format Alamat Literal IPv6 untuk Test Vector `NAT64` (`aulaa_service_test.go`):**
   - Pada daftar test di baris 526 tertulis `"64:ff9b:1::169.254.169.254"`. Di RFC 4291 dan parser Go `net.ParseIP`, notasi *dotted-quad* IPv4 di ekor alamat IPv6 hanya valid pada posisi **32-bit paling kanan** (setelah 96 bit pertama). Karena `64:ff9b:1::` menempati 48 bit namun `::` menggeser `169.254.169.254` ke bit 96–127 dengan benar pada `64:ff9b:1::169.254.169.254`, pastikan saat menulis tabel test diverifikasi bahwa `ip := net.ParseIP(tc)` **tidak `nil`** (`if ip == nil { t.Fatalf("invalid test IP literal %q", tc) }`) — mis. uji keduanya: `"64:ff9b::127.0.0.1"` / `"64:ff9b::a9fe:a9fe"` dan `"64:ff9b:1::a9fe:a9fe"` / `"64:ff9b:1::169.254.169.254"` dengan assertion `ip != nil` eksplisit supaya test tidak *false-pass* hanya karena `isDisallowedAulaaIP(nil) == true`!
2. **Akses Thread-Safe `RedisClient` saat `go test -race` (`redis_fiber_storage.go` & `security_test.go`):**
   - Di `internal/database/redis.go`, variabel `RedisClient` dilindungi oleh `redisMu` saat test mengganti client (`useMiniRedis` / `useNoRedis`). Agar bebas data race saat `go test -race`, ambil pointer lokal `client` melalui helper baca yang dilindungi `redisMu.RLock()` (mis. fungsi `getRedisClient() (*redis.Client, bool)` di paket `database` yang me-return `RedisClient, isRedisUp && RedisClient != nil` dalam satu `RLock`), lalu panggil `client.Get(...)` / `client.Set(...)` memakai variabel lokal `client` tersebut (bukan membaca variabel paket `RedisClient` di luar lock setelah `IsRedisAvailable()`).
   - Selain itu, karena `useMiniRedis(t)` di `redis_test.go` bersifat unexported (hanya di paket `database`), untuk `TestDistributedRateLimiter_MultiInstance` di paket `middleware` (`security_test.go`), agent cukup men-setup `miniredis.RunT(t)` + helper exported kecil seperti `database.SetRedisClientForTest(client, true)` (dengan `redisMu.Lock()` + `GetRateLimiterStorage().Reset()` di `t.Cleanup`) supaya bersih dari race condition lintas paket.
3. **Sinkronisasi `ValidateAulaaBaseURL` dengan `isDisallowedAulaaIP` Baru:**
   - Karena `ValidateAulaaBaseURL` di `aulaa_service.go:70,75` sudah memanggil `isDisallowedAulaaIP`, memperbarui `isDisallowedAulaaIP` secara otomatis akan memperkuat **kedua lapisan sekaligus** (validasi saat simpan setting admin + validasi saat `DialContext` runtime). Pertahankan perilaku berlapis tersebut dan jangan menghapus `ValidateAulaaBaseURL` yang sudah ada.

---

## 3. Keputusan Akhir

**✅ LAYAK LANGSUNG DIJALANKAN OLEH AGENT LAIN.**  
Silakan tugaskan agent eksekutor untuk mengeksekusi `security-audit/implementation-plan-fase-2-2026-11-15.md` dengan memperhatikan 3 poin *polish* kecil di Seksi 2 di atas, lalu setelah selesai saya siap melakukan verifikasi audit independen atas hasil kodenya (seperti pada Fase 1).

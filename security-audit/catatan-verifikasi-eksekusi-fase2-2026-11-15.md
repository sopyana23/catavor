# Catatan Verifikasi Independen — Hasil Eksekusi Fase 2 (Anti-DNS Rebinding & Distributed Rate Limiter)

**Tanggal Verifikasi:** 15 November 2026  
**Reviewer Independen:** Hermes Agent (Security Code Audit)  
**Dokumen Acuan:**  
- `security-audit/implementation-plan-fase-2-2026-11-15.md`  
- `security-audit/catatan-review-plan-fase2-2026-11-15.md`  
- `security-audit/implementation-plan-putaran-8-2026-11-14.md`  
**Baseline Git:** `b0517bc` + working tree Fase 2  
**Keputusan Akhir:** ✅ **LULUS VERIFIKASI PENUH (0 BLOCKER, 0 REGRESI)** — Siap di-commit & lanjut ke Fase 3  

---

## 1. Ringkasan Audit Silang (Klaim Agent vs Kode Aktual & Bukti Runtime)

Seluruh perubahan kode di `backend/internal/services/`, `backend/internal/database/`, dan `backend/internal/middleware/` serta klaim hasil eksekusi pada bagian 6–7 `implementation-plan-fase-2-2026-11-15.md` telah diaudit baris demi baris dan diuji ulang secara independen.

| Paket | Kode Temuan | Verifikasi Implementasi Aktual | Verifikasi Test & Runtime Independen | Status |
|---|---|---|---|---|
| **2.1** | **`N-48`** (MEDIUM — Anti-DNS Rebinding & SSRF Guard Aulaa) | `aulaa_service.go:86-234, 345-518`:<br>- Tabel `disallowedIPNets` memblokir `0.0.0.0/8` (termasuk `0.0.0.1`–`0.255.255.255`), CGNAT `100.64.0.0/10`, `192.0.0.0/24`, Benchmark `198.18.0.0/15`, Class E `240.0.0.0/4`, Broadcast `255.255.255.255/32`, dan IPv6 NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`), ditambah normalisasi `ip.To4()` untuk IPv4-mapped IPv6.<br>- Singleton `safeAulaaHTTPClient` level paket dengan batas pool produksi (`MaxIdleConns: 50`, `MaxIdleConnsPerHost: 10`, `IdleConnTimeout: 90s`, `TLSHandshakeTimeout: 10s`) — **bebas socket/goroutine leak**.<br>- `DialContext` mengevaluasi `isAulaaLocalHTTPAllowed()` secara dinamis, menolak total jika ada 1 saja IP terlarang (*anti dual-record DNS poisoning*), melakukan sequential failover multi-IP (`perDialTimeout: 3s` saat multi-IP), dan memblokir HTTP 30x redirect (`http.ErrUseLastResponse`).<br>- Ke-4 fungsi (`CreateAulaaPayment`, `CheckAulaaPaymentStatus`, `GetAulaaPaymentMethods`, `CancelAulaaPayment`) menegakkan `validateAulaaBaseURLScheme` pre-request dan `io.LimitReader(resp.Body, 2MB)`. | Seluruh 6 test baru di `aulaa_service_test.go` (`CompleteCIDR` dengan assertion `ip != nil`, `TOCTOUDNSRebinding`, `DualRecordPoisoning`, `MultiIPFailover`, `RejectsRedirect`, `SchemeValidation`) dieksekusi runtime nyata (tanpa `os.ReadFile`), **PASS 100%** (`0.045s`). | ✅ **LULUS** |
| **2.2** | **`N-49`** (MEDIUM — Distributed Redis Rate Limiter) | `redis_fiber_storage.go:1-258`, `redis.go:89-100`, `security.go:229,260,279,299`:<br>- `RedisFiberStorage` mengimplementasikan `fiber.Storage` di atas `database.RedisClient` dengan prefix `catavor:ratelimit:`, `SCAN` + batch `DEL` non-blocking pada `Reset()` (dengan pengecekan error `pipe.Exec`), dan log `Warn` ber-throttle CAS `atomic.Int64` 30 detik.<br>- `memoryFiberStorage` dilengkapi opportunistic GC (`sweepLocked` tiap `30s` / `10.000` entri) dan *hard cap* `50.000` entri (kebal OOM saat Redis offline).<br>- Kontrak `fiber.Storage` (`key == ""` / `len(val) == 0` no-op, cache miss `nil, nil`) dipatuhi penuh.<br>- Dipasang pada ke-4 rate limiter (`GlobalAPIRateLimiter`, `AuthRateLimiter`, `PublicSubmissionRateLimiter`, `TelemetryRateLimiter`). | `TestRedisFiberStorage_MiniRedis`, `TestRedisFiberStorage_NoRedisFallback`, `TestMemoryFiberStorage_AntiOOMAndEviction`, dan **`TestDistributedRateLimiter_MultiInstance`** (2 instance `*fiber.App` berbagi 1 `miniredis`: 10 hit `app1` + 10 hit `app2` = `200`, hit ke-21 & ke-22 = **`429`**) **PASS 100%**. **0 tes baca teks statis (`os.ReadFile`).** | ✅ **LULUS** |

---

## 2. Catatan Observasi Non-Blocker (Kebersihan Minor untuk Ke Depan, Tidak Menghalangi Lulus Fase 2)

Tiga detail kecil berikut **bukan kerentanan hidup** di produksi (dimana `RedisClient` diinisialisasi satu kali via `sync.Once` pada `InitRedis()` dan tidak pernah dimutasi lagi saat runtime), dicatat murni sebagai referensi kebersihan kode:

1. **`security_test.go:485-487` (`rClient.Close()` di cleanup test):** Pada `TestDistributedRateLimiter_MultiInstance`, `cleanup := database.SetRedisClientForTesting(rClient, true)` memulihkan variabel global `RedisClient` dengan benar, dan `miniredis.RunT(t)` menutup server mock di akhir test, namun `defer func() { _ = rClient.Close() }()` pada client `go-redis` lokal test belum dipanggil eksplisit (tidak berdampak ke produksi karena hanya hidup di fungsi test tersebut).
2. **`redis_fiber_storage.go:161-167, 182-188, 201-207, 214-222` (Pembacaan `RedisClient` terhadap `SetRedisClientForTesting`):** Seperti pola eksisting di `redis.go:88-457`, fungsi mengecek `IsRedisAvailable()` (di bawah `redisMu.RLock()`) lalu mengakses variabel paket `RedisClient`. Di produksi ini 100% aman dari race karena `InitRedis()` memakai `sync.Once` sebelum server Fiber menerima trafik; bila kelak host CI menyalakan `-race` dengan test paralel (`t.Parallel()`) lintas fungsi yang memanggil `SetRedisClientForTesting`, menyalin pointer `client` di dalam `RLock` akan membuatnya semakin kedap. (Catatan: di host Windows lokal ini `gcc` tidak terpasang sehingga `-race` memang tidak bisa dikompilasi lokal, dan agent pelaksana sudah jujur mencatat `go test -p 1 -count=1 ./...` di bagian 6–7 tanpa memalsukan output `-race`).
3. **`aulaa_service.go:349, 400, 441, 496` (Trailing Slash pada `cfg.BaseURL` Langsung):** Jika `AulaaConfig` diambil melalui `GetAulaaConfig(db)` atau `ValidateAulaaBaseURL`, trailing slash `/` sudah dibersihkan (`strings.TrimRight`). Jika ada kode internal masa depan membuat `AulaaConfig{BaseURL: "https://api.aulaa.co/v1/"}` secara manual tanpa lewat `ValidateAulaaBaseURL`, `fmt.Sprintf("%s/payments", strings.TrimRight(cfg.BaseURL, "/"))` bisa menjaga path bebas double-slash `//payments`.

---

## 3. Rekap Bukti Eksekusi Verifikasi Independen

- **`GOTOOLCHAIN=auto go vet ./...`:** **0 warning / 0 error**.
- **`GOTOOLCHAIN=auto go test -count=1 ./...`:** Seluruh 9 paket backend ber-test (`config`, `database`, `handlers`, `middleware`, `models`, `security`, `services`, `storage`, `utils`) **PASS 100%**.
- **`GOTOOLCHAIN=auto govulncheck ./...`:** **`No vulnerabilities found.`** (`Your code is affected by 0 vulnerabilities.`).
- **Verifikasi Guardrails:** `0` perubahan frontend, `0` perubahan migrasi DB, `0` unit test berbasis `os.ReadFile`, dan server live `http://127.0.0.1:8000/healthz` tetap sehat **`200 OK`** (`{"status":"ok","uptime":"13h55m35s"}`).

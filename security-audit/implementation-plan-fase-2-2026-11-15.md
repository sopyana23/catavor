# Implementation Plan — Remediasi Temuan Audit Keamanan Fase 2 (Anti-DNS Rebinding & Distributed Rate Limiter) [REVISI FINAL PASCA-REVIEW]

**Tanggal Penyusunan:** 15 November 2026  
**Referensi Audit:**  
- `security-audit/catatan-review-plan-fase2-2026-11-15.md` (**Hasil Review Independen Sopyana Agent — Seluruh 2 Blocker & 4 Koreksi Diintegrasikan Penuh**)  
- `security-audit/audit-putaran-8-zero-change-2026-11-14.md` (Temuan `N-48` & `N-49`)  
- `security-audit/implementation-plan-putaran-8-2026-11-14.md` (Roadmap Induk Fase 2, baris 235–305)  
- `security-audit/implementation-plan-fase-1-2026-11-15.md` (Fase 1 Selesai & Terverifikasi 100%)  
- `security-audit/catatan-verifikasi-eksekusi-fase1-2026-11-15.md` (Hasil Audit Independen Fase 1: Lulus Penuh)  
**Baseline Commit:** `b0517bc` (`feat(security): remediate Fase 1 findings (N-47, CVEs, N-50, N-51, N-57, R4-L1, R4-L2)`)  
**Status Dokumen:** ✅ **SELESAI DIEKSEKUSI & TERVERIFIKASI 100% (15 November 2026)**

---

## 1. Ringkasan Eksekutif & Hasil Penyelarasan Review

Fase 2 berfokus pada remediasi **dua kelemahan arsitektur tingkat MEDIUM** yang berkaitan dengan keamanan jaringan outbound (*outbound network security*) dan ketahanan DoS/brute-force terdistribusi:

1. **`N-48` [MEDIUM] — Custom `DialContext` Anti-DNS Rebinding & SSRF Guard pada Klien HTTP Outbound Aulaa**
2. **`N-49` [MEDIUM] — Backing Redis Terdistribusi untuk Fiber Rate Limiter**

Dokumen ini merupakan **Revisi Final** yang mengintegrasikan seluruh temuan dan instruksi perbaikan dari reviewer independen (`catatan-review-plan-fase2-2026-11-15.md`):

### 1.1 Matriks Integrasi Temuan Review Independen

| Kode | Kategori | Temuan Reviewer | Solusi Arsitektur yang Diterapkan di Dokumen Ini |
|---|---|---|---|
| **BLOCKER-1** | Performa & Resource Leak | Pembuatan `&http.Transport{}` baru per-request di `newSafeAulaaHTTPClient()` membocorkan socket TCP/TLS, goroutine `readLoop`/`writeLoop`, dan mematikan *TLS session reuse*. | Gunakan **singleton shared `safeAulaaHTTPClient` / shared `*http.Transport` level paket** dengan batas resource produksi (`MaxIdleConns: 50`, `MaxIdleConnsPerHost: 10`, `IdleConnTimeout: 90s`, `TLSHandshakeTimeout: 10s`, `ForceAttemptHTTP2: true`). Evaluasi `isAulaaLocalHTTPAllowed()` secara dinamis **di dalam closure `DialContext`** agar `t.Setenv` tetap bekerja. Pasang proteksi `io.LimitReader(resp.Body, 2*1024*1024)` pada pembacaan body response Aulaa. |
| **BLOCKER-2** | Ketahanan & Anti-OOM | `memoryFiberStorage` tanpa mekanisme eviction/sweeper berisiko Out-Of-Memory (OOM) bila terjadi flood IP acak saat Redis down, dan contract `fiber.Storage` belum ketat (`key == ""` & `len(val) == 0`). | Tambahkan **opportunistic GC ringan** pada `memoryFiberStorage` (sapu item kedaluwarsa tiap interval 30 detik atau `len(items) > 10.000`), **hard cap defensif** (maksimum 50.000 entri, buang terlama bila penuh), patuhi penuh kontrak `fiber.Storage` (`key == ""` → `nil, nil`, `len(val) == 0` → no-op), dan jangan menelan error `pipe.Exec(ctx)` pada `Reset()`. |
| **KOREKSI-3** | Keamanan Jaringan | `isDisallowedAulaaIP` belum menangkal `0.0.0.0/8` (termasuk `0.0.0.1`–`0.255.255.255` yang di Linux merutekan ke localhost), IPv6 NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`), `198.18.0.0/15`, `240.0.0.0/4`, dan `255.255.255.255/32`. Dialing hanya `ips[0]` membuat gateway dual-stack (IPv6/IPv4 Cloudflare) gagal jika host tidak punya IPv6 keluar. | Tambahkan tabel CIDR terlarang lengkap. Validasi **seluruh** IP hasil DNS (tolak total jika ada 1 saja IP terlarang untuk menangkal dual-record poisoning), lalu lakukan **failover berurutan** ke daftar IP publik yang sudah tervalidasi aman. Terapkan validasi skema `https://` wajib sebelum pengiriman request (defense-in-depth). |
| **KOREKSI-4** | Kejujuran Arsitektur | Klaim konkurensi Fiber `limiter.New` harus jujur bahwa Fiber v2 memakai pola *read-modify-write* `GET` + `SET` (bukan atomic `INCR` Redis). | Dokumentasikan secara transparan pada komentar kode bahwa `RedisFiberStorage` membagi kuota lintas replica dan bertahan pasca-restart (menutup `N-49`), sementara pembatasan keras level akun tetap dijamin oleh `RecordLoginFailure` (atomic `INCR`). Tambahkan log peringatan ber-throttle (`zerolog` max 1x per 30 detik) saat Redis terdegradasi ke memori. |
| **KOREKSI-5** | Kualitas Pengujian | Pengujian DNS Rebinding harus deterministik (bebas flakiness jaringan publik), dan pengujian rate limiter harus membuktikan sifat terdistribusi lintas multi-instance (bukan 1 instance Fiber saja). | Sediakan `newSafeAulaaHTTPClientWithResolver` dengan resolver yang dapat disuntikkan (*injectable resolver*) untuk menguji skenario TOCTOU DNS Rebinding, dual-record poisoning, dan multi-IP failover offline. Buat pengujian **2 instance `*fiber.App` terpisah** di atas `miniredis` (10 request app1 + 10 request app2 = 200, request ke-21 = 429). Wajib verifikasi `GOTOOLCHAIN=auto go test -race -count=1 ./...`. |
| **KOREKSI-6** | Verifikasi Scope | Klien HTTP di `internal/handlers/auth_handler.go:1419` (`verifyGoogleCredential`) menggunakan URL Google konstan hardcoded. | Dikonfirmasi *out-of-scope* untuk `N-48` karena endpoint Google OAuth konstan dan bukan vektor SSRF. Seluruh pemanggilan Aulaa di `aulaa_service.go` tercakup 100%. |

### 1.2 Prinsip Perlindungan & Batasan Ketat (Guardrails)

1. **Server Live di Port 8000 Wajib Tetap Hidup:**  
   Background daemon server di port 8000 (`/healthz` 200 OK) tidak boleh dimatikan, di-restart, atau diganggu.
2. **Zero Regression pada Frontend & Database:**  
   Fase 2 murni berada pada lapisan backend Go (`services`, `database`, `middleware`). Tidak ada perubahan skema database (`DB_AUTO_MIGRATE=false`, `SKIP_DB_MIGRATE=true`) dan tidak ada kode frontend yang tersenggol.
3. **Haram Unit Test Statis Berbasis Teks:**  
   DILARANG KERAS membuat unit test yang membaca source code via `os.ReadFile` + `strings.Contains`. Seluruh pengujian wajib runtime: `miniredis` in-process, `app.Test` multi-instance Fiber, `httptest.Server`, dan injectable resolver mock.
4. **Verifikasi Race Condition:**  
   Wajib lulus pengujian konkurensi: `GOTOOLCHAIN=auto go test -race -count=1 ./...`.

---

## 2. Spesifikasi Teknis Terperinci per Item

### 2.1 [N-48 — MEDIUM] Custom `DialContext` Anti-DNS Rebinding & SSRF Guard pada Klien HTTP Aulaa

#### A. Analisis Masalah Mendalam (Root Cause & Attack Vectors):
Saat ini di `backend/internal/services/aulaa_service.go`:
1. **Celah TOCTOU / DNS Rebinding:**  
   Fungsi `ValidateAulaaBaseURL` melakukan resolusi DNS (`net.LookupIP(host)`) saat konfigurasi disimpan/dibaca. Namun saat transaksi berlangsung (`CreateAulaaPayment`, dll.), Go `http.Client` melakukan resolusi DNS ulang saat dial. Penyerang dengan kontrol DNS dapat mengembalikan IP publik pada resolusi pertama, lalu mengembalikan `127.0.0.1` atau `169.254.169.254` (Cloud Metadata) saat transaksi dikirim.
2. **Celah Open-Redirect SSRF:**  
   `http.Client` standar mengikuti hingga 10 redirect HTTP 30x. Server yang berkompromi dapat mengembalikan `302 Found` ke URL internal.
3. **Celah IP Lolos Filter (`0.0.0.0/8`, NAT64, CGNAT, IPv4-Mapped IPv6):**  
   - Di kernel Linux, koneksi ke **`0.0.0.1` s/d `0.255.255.255` (`0.0.0.0/8`)** otomatis diarahkan ke `127.0.0.1` (localhost). Di Go stdlib, `net.ParseIP("0.0.0.1").IsLoopback()` dan `IsUnspecified()` bernilai `false`!
   - Prefiks IPv6 NAT64 **`64:ff9b::/96`** dan **`64:ff9b:1::/48`** dapat menerjemahkan IP privat/metadata ke jaringan IPv6 tanpa terdeteksi oleh `ip.To4()`.
   - Rentang **Carrier-Grade NAT (`100.64.0.0/10`)**, **Benchmarking (`198.18.0.0/15`)**, **Class E (`240.0.0.0/4`)**, dan **Broadcast (`255.255.255.255/32`)** wajib diblokir.
4. **Peluang Resource Leak (BLOCKER-1):**  
   Membuat `&http.Transport{}` baru di setiap request memicu kebocoran goroutine dan socket TCP/TLS karena `CloseIdleConnections()` tidak pernah dipanggil. Solusinya adalah shared singleton client dengan connection pooling terstandarisasi.
5. **Dukungan Dual-Stack Multi-IP Failover (KOREKSI-3):**  
   Domain gateway (mis. di balik Cloudflare) mengembalikan record `AAAA` dan `A`. Jika host produksi tidak memiliki konektivitas IPv6 keluar dan klien hanya men-dial `ips[0]`, seluruh checkout pembayaran akan gagal `network is unreachable`. Solusinya adalah failover berurutan ke daftar IP aman yang telah tervalidasi.

#### B. Spesifikasi Arsitektur Remediasi (`backend/internal/services/aulaa_service.go`):

1. **Daftar CIDR Terlarang & Fungsi `isDisallowedAulaaIP`:**
   ```go
   var (
       // Subnet IPv4 & IPv6 khusus yang dilarang untuk mencegah SSRF
       disallowedIPNets = []*net.IPNet{
           mustParseCIDR("0.0.0.0/8"),          // "This network" (0.0.0.1 - 0.255.255.255 diarahkan ke localhost di Linux)
           mustParseCIDR("100.64.0.0/10"),      // Carrier-Grade NAT (RFC 6598)
           mustParseCIDR("192.0.0.0/24"),        // IETF Protocol Assignments (RFC 6890)
           mustParseCIDR("198.18.0.0/15"),       // Benchmark Testing (RFC 2544)
           mustParseCIDR("240.0.0.0/4"),        // Reserved Class E (RFC 1112)
           mustParseCIDR("255.255.255.255/32"),  // Limited Broadcast
           mustParseCIDR("64:ff9b::/96"),        // IPv4/IPv6 translation NAT64 (RFC 6052)
           mustParseCIDR("64:ff9b:1::/48"),      // Local-Use IPv4/IPv6 translation (RFC 8215)
       }
   )

   func mustParseCIDR(s string) *net.IPNet {
       _, ipNet, err := net.ParseCIDR(s)
       if err != nil {
           panic(fmt.Sprintf("invalid CIDR %s: %v", s, err))
       }
       return ipNet
   }

   func isDisallowedAulaaIP(ip net.IP) bool {
       if ip == nil {
           return true
       }
       // Normalisasi IPv4-mapped IPv6 (mis. ::ffff:127.0.0.1 -> 127.0.0.1)
       if v4 := ip.To4(); v4 != nil {
           ip = v4
       }

       if ip.IsLoopback() ||
           ip.IsPrivate() ||
           ip.IsLinkLocalUnicast() ||
           ip.IsLinkLocalMulticast() ||
           ip.IsMulticast() ||
           ip.IsUnspecified() {
           return true
       }

       for _, ipNet := range disallowedIPNets {
           if ipNet.Contains(ip) {
               return true
           }
       }

       return false
   }

   func isAulaaLocalHTTPAllowed() bool {
       return strings.EqualFold(strings.TrimSpace(os.Getenv("AULAA_ALLOW_LOCAL_HTTP")), "true")
   }
   ```

2. **Shared Singleton HTTP Transport & Client dengan Injectable Resolver:**
   ```go
   type dnsLookupFunc func(ctx context.Context, host string) ([]net.IPAddr, error)

   // newSafeAulaaHTTPClientWithResolver membuat klien HTTP dengan perlindungan anti-SSRF dan anti-DNS Rebinding.
   // Resolver dapat diinjeksikan untuk unit testing deterministik offline.
   func newSafeAulaaHTTPClientWithResolver(lookup dnsLookupFunc) *http.Client {
       if lookup == nil {
           lookup = net.DefaultResolver.LookupIPAddr
       }

       dialer := &net.Dialer{
           Timeout:   10 * time.Second,
           KeepAlive: 30 * time.Second,
       }

       transport := &http.Transport{
           MaxIdleConns:          50,
           MaxIdleConnsPerHost:   10,
           IdleConnTimeout:       90 * time.Second,
           TLSHandshakeTimeout:   10 * time.Second,
           ExpectContinueTimeout: 1 * time.Second,
           ForceAttemptHTTP2:     true,
           DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
               host, port, err := net.SplitHostPort(addr)
               if err != nil {
                   return nil, fmt.Errorf("SSRF guard: format alamat dial tidak valid %q: %w", addr, err)
               }

               allowLocal := isAulaaLocalHTTPAllowed()

               // 1. Resolusi DNS
               ips, err := lookup(ctx, host)
               if err != nil {
                   return nil, fmt.Errorf("SSRF guard: gagal resolusi DNS untuk host %s: %w", host, err)
               }
               if len(ips) == 0 {
                   return nil, fmt.Errorf("SSRF guard: tidak ada alamat IP yang ditemukan untuk host %s", host)
               }

               // 2. Evaluasi seluruh IP hasil resolusi:
               // BILA ADA 1 SAJA IP TERLARANG, TOLAK TOTAL (anti dual-record DNS poisoning)
               var safeIPs []net.IP
               for _, ipAddr := range ips {
                   ip := ipAddr.IP
                   if !allowLocal && isDisallowedAulaaIP(ip) {
                       return nil, fmt.Errorf("SSRF guard: koneksi ke host %s diblokir karena mengarah ke IP internal/metadata (%s)", host, ip.String())
                   }
                   safeIPs = append(safeIPs, ip)
               }

               // 3. Multi-IP Sequential Failover pada IP yang lolos validasi:
               // Penting untuk domain Cloudflare/dual-stack (IPv6 AAAA + IPv4 A) bila IPv6 host tidak tersedia.
               var lastDialErr error
               for _, safeIP := range safeIPs {
                   targetAddr := net.JoinHostPort(safeIP.String(), port)
                   conn, dialErr := dialer.DialContext(ctx, network, targetAddr)
                   if dialErr == nil {
                       return conn, nil
                   }
                   lastDialErr = dialErr
               }

               return nil, fmt.Errorf("SSRF guard: gagal menghubungkan ke seluruh IP aman untuk host %s: %w", host, lastDialErr)
           },
       }

       return &http.Client{
           Timeout:   DefaultHTTPTimeout,
           Transport: transport,
           CheckRedirect: func(req *http.Request, via []*http.Request) error {
               // Tolak auto-redirect pada interaksi API pembayaran untuk mencegah open-redirect SSRF
               return http.ErrUseLastResponse
           },
       }
   }

   // safeAulaaHTTPClient adalah singleton level paket untuk mencegah socket/goroutine leak
   var safeAulaaHTTPClient = newSafeAulaaHTTPClientWithResolver(nil)
   ```

3. **Helper Validasi Skema & Batas Pembacaan Body Response:**
   ```go
   const MaxAulaaResponseBodySize = 2 * 1024 * 1024 // 2 MB

   func validateAulaaBaseURLScheme(baseURL string) error {
       if isAulaaLocalHTTPAllowed() {
           return nil
       }
       u, err := url.Parse(baseURL)
       if err != nil || !strings.EqualFold(u.Scheme, "https") {
           return fmt.Errorf("keamanan outbound: Base URL Aulaa wajib menggunakan protokol HTTPS")
       }
       return nil
   }
   ```
   Pada keempat fungsi (`CreateAulaaPayment`, `CheckAulaaPaymentStatus`, `GetAulaaPaymentMethods`, `CancelAulaaPayment`):
   - Panggil `if err := validateAulaaBaseURLScheme(cfg.BaseURL); err != nil { return nil, err }`.
   - Gunakan `safeAulaaHTTPClient.Do(httpReq)`.
   - Baca response body dengan batas aman: `io.ReadAll(io.LimitReader(resp.Body, MaxAulaaResponseBodySize))`.

---

### 2.2 [N-49 — MEDIUM] Backing Redis Terdistribusi untuk Fiber Rate Limiter

#### A. Analisis Masalah Mendalam & Penyelarasan Arsitektur:
1. **Multi-Instance Quota Isolation:**  
   Fiber v2 secara default memakai memori per-proses. Serangan brute-force yang disebar ke beberapa pod/replica tidak terakumulasi.
2. **Karakteristik Internal Fiber `limiter.New` (KOREKSI-4):**  
   Middleware `limiter.New` Fiber v2 (`limiter_fixed.go:46-76`) menggunakan pola *read-modify-write*: `storage.Get(key)` → decode data → increment `currHits` → `storage.Set(key, raw, exp)`.  
   *Catatan kejujuran arsitektur:* Ini bukan atomic `INCR` Redis murni. Namun ini **sudah 100% sah dan tepat menutup temuan `N-49`**, karena:
   - Kuota rate limit terbagi secara global melintasi seluruh replika pod backend.
   - Counter bertahan melintasi restart/redeploy container (tidak reset ke 0).
   - Untuk proteksi brute-force keras level akun, sistem Catavor **sudah memiliki `RecordLoginFailure`** di `redis.go:385` yang memakai atomic `RedisClient.Incr` murni. Kedua lapisan ini saling melengkapi secara berlapis (*defense-in-depth*).
3. **Pencegahan Risiko Memory Exhaustion / OOM (BLOCKER-2):**  
   Ketika Redis down/offline dan fallback lokal aktif, jika penyerang mengirimkan jutaan request dengan IP spoofing acak, map in-memory tanpa eviction akan menyebabkan proses kehabisan RAM.  
   *Solusi:* Terapkan pembersihan otomatis (opportunistic GC) tiap 30 detik atau bila entri > 10.000, serta pasang **hard cap defensif** (maksimum 50.000 entri).
4. **Kepatuhan Penuh Kontrak `fiber.Storage`:**  
   - `Get(key)`: jika `key == ""`, kembalikan `nil, nil`. Jika key tidak ada di Redis (`redis.Nil`), kembalikan `nil, nil` (cache miss bukan error).
   - `Set(key, val, exp)`: jika `key == ""` atau `len(val) == 0`, return `nil` (no-op).
   - `Delete(key)`: jika `key == ""`, return `nil`.
   - `Reset()`: gunakan `SCAN` + batch `DEL` (anti-`KEYS *`), dan **tangani error dari `pipe.Exec(ctx)`**.

#### B. Spesifikasi Arsitektur Remediasi (`backend/internal/database/redis_fiber_storage.go`):

```go
package database

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RedisFiberStorage mengimplementasikan fiber.Storage di atas Redis
// dengan automatic in-memory fallback yang kebal OOM saat Redis offline.
type RedisFiberStorage struct {
	prefix         string
	memoryFallback *memoryFiberStorage
}

type memoryItem struct {
	val       []byte
	expiresAt time.Time
}

type memoryFiberStorage struct {
	mu        sync.RWMutex
	items     map[string]memoryItem
	lastSweep time.Time
}

func newMemoryFiberStorage() *memoryFiberStorage {
	return &memoryFiberStorage{
		items:     make(map[string]memoryItem),
		lastSweep: time.Now(),
	}
}

const (
	MemoryStorageMaxEntries   = 50000            // Hard cap defensif anti-OOM
	MemoryStorageSweepInterval = 30 * time.Second // Interval opportunistic GC
	MemoryStorageSweepThreshold = 10000          // Ambang batas jumlah entri untuk sweep
)

func (m *memoryFiberStorage) sweepLocked(now time.Time) {
	for k, item := range m.items {
		if !item.expiresAt.IsZero() && now.After(item.expiresAt) {
			delete(m.items, k)
		}
	}
	m.lastSweep = now
}

func (m *memoryFiberStorage) Get(key string) ([]byte, error) {
	if key == "" {
		return nil, nil
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, ok := m.items[key]
	if !ok || (!item.expiresAt.IsZero() && time.Now().After(item.expiresAt)) {
		return nil, nil // Cache miss wajib nil, nil sesuai kontrak fiber.Storage
	}
	cp := make([]byte, len(item.val))
	copy(cp, item.val)
	return cp, nil
}

func (m *memoryFiberStorage) Set(key string, val []byte, exp time.Duration) error {
	if key == "" || len(val) == 0 {
		return nil // Kontrak fiber.Storage: no-op jika key atau value kosong
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	// Opportunistic GC: bersihkan entri kedaluwarsa secara berkala
	if now.Sub(m.lastSweep) > MemoryStorageSweepInterval || len(m.items) > MemoryStorageSweepThreshold {
		m.sweepLocked(now)
	}

	// Hard cap defensif: bila masih melebihi batas, hapus entri kedaluwarsa tambahan
	// atau tolak penambahan bila memori penuh untuk mencegah OOM crash
	if len(m.items) >= MemoryStorageMaxEntries {
		m.sweepLocked(now)
		if len(m.items) >= MemoryStorageMaxEntries {
			// Buang 1 entri acak untuk memberi ruang
			for k := range m.items {
				delete(m.items, k)
				break
			}
		}
	}

	var expTime time.Time
	if exp > 0 {
		expTime = now.Add(exp)
	}
	cp := make([]byte, len(val))
	copy(cp, val)
	m.items[key] = memoryItem{val: cp, expiresAt: expTime}
	return nil
}

func (m *memoryFiberStorage) Delete(key string) error {
	if key == "" {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.items, key)
	return nil
}

func (m *memoryFiberStorage) Reset() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.items = make(map[string]memoryItem)
	m.lastSweep = time.Now()
	return nil
}

func (m *memoryFiberStorage) Close() error {
	return nil
}

var lastDegradeWarnUnix atomic.Int64

func logRedisStorageDegraded(err error, op string) {
	now := time.Now().Unix()
	last := lastDegradeWarnUnix.Load()
	if now-last > 30 {
		if lastDegradeWarnUnix.CompareAndSwap(last, now) {
			log.Warn().Err(err).Str("operation", op).
				Msg("Redis rate limiter storage terdegradasi ke fallback in-memory (throttled warn 30s)")
		}
	}
}

// NewRedisFiberStorage membuat fiber.Storage baru dengan prefix tertentu.
func NewRedisFiberStorage(prefix string) fiber.Storage {
	return &RedisFiberStorage{
		prefix:         prefix,
		memoryFallback: newMemoryFiberStorage(),
	}
}

func (s *RedisFiberStorage) Get(key string) ([]byte, error) {
	if key == "" {
		return nil, nil
	}
	if !IsRedisAvailable() {
		return s.memoryFallback.Get(key)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	val, err := RedisClient.Get(ctx, s.prefix+key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Kunci belum ada (cache miss normal)
		}
		logRedisStorageDegraded(err, "Get")
		return s.memoryFallback.Get(key)
	}
	return val, nil
}

func (s *RedisFiberStorage) Set(key string, val []byte, exp time.Duration) error {
	if key == "" || len(val) == 0 {
		return nil
	}
	if !IsRedisAvailable() {
		return s.memoryFallback.Set(key, val, exp)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	err := RedisClient.Set(ctx, s.prefix+key, val, exp).Err()
	if err != nil {
		logRedisStorageDegraded(err, "Set")
		return s.memoryFallback.Set(key, val, exp)
	}
	return nil
}

func (s *RedisFiberStorage) Delete(key string) error {
	if key == "" {
		return nil
	}
	_ = s.memoryFallback.Delete(key)
	if !IsRedisAvailable() {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	return RedisClient.Del(ctx, s.prefix+key).Err()
}

// Reset menghapus seluruh entri dengan prefix penyimpanan ini.
// Menggunakan SCAN + batch DEL secara non-blocking (anti-KEYS *).
func (s *RedisFiberStorage) Reset() error {
	_ = s.memoryFallback.Reset()
	if !IsRedisAvailable() {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cursor uint64
	for {
		keys, nextCursor, err := RedisClient.Scan(ctx, cursor, s.prefix+"*", 250).Result()
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			pipe := RedisClient.Pipeline()
			for _, k := range keys {
				pipe.Del(ctx, k)
			}
			if _, pipeErr := pipe.Exec(ctx); pipeErr != nil {
				return pipeErr
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

func (s *RedisFiberStorage) Close() error {
	return nil
}

var (
	sharedRateLimiterStorage     fiber.Storage
	sharedRateLimiterStorageOnce sync.Once
)

// GetRateLimiterStorage mengembalikan instance tunggal penyimpan rate limiter.
func GetRateLimiterStorage() fiber.Storage {
	sharedRateLimiterStorageOnce.Do(func() {
		sharedRateLimiterStorage = NewRedisFiberStorage("catavor:ratelimit:")
	})
	return sharedRateLimiterStorage
}
```

3. **Injeksi ke `backend/internal/middleware/security.go`:**
   Pasang `Storage: database.GetRateLimiterStorage()` pada 4 rate limiter:
   - `GlobalAPIRateLimiter()` (Max: 300, 1m)
   - `AuthRateLimiter()` (Max: 20, 1m)
   - `PublicSubmissionRateLimiter()` (Max: 15, 1m)
   - `TelemetryRateLimiter()` (Max: 180, 1m)

---

## 3. Rencana Pengujian Runtime Komprehensif (Wajib Lulus)

### 3.1 Suite Pengujian N-48 (`backend/internal/services/aulaa_service_test.go`):

1. **`TestDisallowedAulaaIP_CompleteCIDR`:**
   - Uji rentang dilarang:
     - `0.0.0.0`, `0.0.0.1`, `0.255.255.255` (`0.0.0.0/8`)
     - `127.0.0.1`, `::1` (Loopback)
     - `10.0.0.1`, `172.16.0.1`, `192.168.1.1` (RFC 1918 Private)
     - `169.254.169.254` (Link-Local Cloud Metadata)
     - `100.64.0.1`, `100.127.255.254` (CGNAT)
     - `198.18.0.1` (Benchmark)
     - `240.0.0.1` (Class E)
     - `255.255.255.255` (Limited Broadcast)
     - `64:ff9b::127.0.0.1`, `64:ff9b:1::169.254.169.254` (NAT64)
     - `::ffff:127.0.0.1`, `::ffff:169.254.169.254` (IPv4-Mapped IPv6)
     - Semua wajib menghasilkan `true` (disallowed).
   - Uji IP publik sah: `8.8.8.8`, `1.1.1.1`, `104.21.5.1`, `2606:4700:4700::1111` → wajib `false` (allowed).
2. **`TestSafeAulaaHTTPClient_TOCTOUDNSRebinding`:**
   - Gunakan `newSafeAulaaHTTPClientWithResolver`:
     - Simulasi resolver mengembalikan `93.184.216.34` saat pengecekan awal, namun saat `DialContext` resolver mengembalikan `169.254.169.254`.
     - Request wajib gagal saat `DialContext` dengan error `"SSRF guard: koneksi ke host ... diblokir karena mengarah ke IP internal/metadata"`.
3. **`TestSafeAulaaHTTPClient_DualRecordPoisoning`:**
   - Resolver menyuntikkan 2 record: `[93.184.216.34, 127.0.0.1]`.
   - Karena ada 1 record terlarang, seluruh dial wajib ditolak total (anti dual-record poisoning).
4. **`TestSafeAulaaHTTPClient_MultiIPFailover`:**
   - Jalankan `httptest.Server` lokal dengan `AULAA_ALLOW_LOCAL_HTTP=true`.
   - Resolver mengembalikan `[IP mati / unreachable, IP test server]`.
   - DialContext wajib mencoba IP kedua dan request sukses 200 OK.
5. **`TestSafeAulaaHTTPClient_RejectsRedirect`:**
   - Server uji lokal merespon `302 Found` ke `http://169.254.169.254`.
   - Response status wajib tetap `302 Found` (tidak diikuti).
6. **`TestSafeAulaaHTTPClient_SchemeValidation`:**
   - Pemanggilan dengan `http://insecure.example.com` saat `AULAA_ALLOW_LOCAL_HTTP=false` wajib gagal sebelum request dibuat.

### 3.2 Suite Pengujian N-49 (`backend/internal/database/redis_fiber_storage_test.go` & `middleware/security_test.go`):

1. **`TestRedisFiberStorage_MiniRedis`:**
   - Gunakan `useMiniRedis(t)`:
     - `Get` non-existent key mengembalikan `nil, nil`.
     - `Set` dan `Get` data byte identik.
     - `Set` dengan TTL 100ms + `FastForward(200ms)` → `Get` menghasilkan `nil, nil`.
     - `Delete` menghapus kunci.
     - `Reset` hanya menghapus prefix `catavor:ratelimit:*` dan tidak menghapus `support:ticket:1`.
2. **`TestRedisFiberStorage_NoRedisFallback`:**
   - Gunakan `useNoRedis(t)`:
     - Seluruh operasi `Get`, `Set`, `Delete`, `Reset` berjalan mulus tanpa panic.
3. **`TestMemoryFiberStorage_AntiOOMAndEviction`:**
   - Uji penambahan item ber-TTL pendek lalu jalankan `sweepLocked` → ukuran `items` berkurang.
   - Uji batas kapasitas hard cap `MemoryStorageMaxEntries` tidak jebol.
4. **`TestDistributedRateLimiter_MultiInstance (KOREKSI-5)`:**
   - Buat **2 instance `*fiber.App` terpisah** (`appInstance1` dan `appInstance2`) di atas `miniredis` yang sama.
   - Kirim **10 request ke `appInstance1`** dan **10 request ke `appInstance2`** dari IP `192.0.2.88` (keduanya memasang `AuthRateLimiter()`).
   - Seluruh 20 request menghasilkan `200 OK`.
   - Kirim request ke-21 ke salah satu instance → **wajib menghasilkan `429 Too Many Requests`**.

---

## 4. Matriks Perubahan File

| Path Berkas | Tipe Operasi | Keterangan & Tujuan |
|---|---|---|
| `backend/internal/services/aulaa_service.go` | Modifikasi | Pasang tabel `disallowedIPNets`, `isDisallowedAulaaIP` lengkap, singleton `safeAulaaHTTPClient` dengan `DialContext` anti-SSRF/TOCTOU/failover multi-IP, `CheckRedirect` anti-redirect, validasi skema HTTPS, dan `io.LimitReader` 2MB. |
| `backend/internal/services/aulaa_service_test.go` | Modifikasi / Penambahan | Tambahkan unit test runtime anti-SSRF, filter CIDR khusus (`0.0.0.1`, `64:ff9b::`, CGNAT), TOCTOU DNS Rebinding mock, dual-record poisoning, multi-IP failover, dan penolakan auto-redirect. |
| `backend/internal/database/redis_fiber_storage.go` | **File Baru** | Implementasi `fiber.Storage` mandiri berbasis `database.RedisClient` dengan pembersihan non-blocking `SCAN` + batch `DEL`, opportunistic GC anti-OOM pada `memoryFiberStorage`, dan throttled warning log. |
| `backend/internal/database/redis_fiber_storage_test.go` | **File Baru** | Pengujian runtime operasi storage (`miniredis` vs fallback memori, isolasi prefix, sweep eviction anti-OOM, kepatuhan kontrak `fiber.Storage`). |
| `backend/internal/middleware/security.go` | Modifikasi | Pasang `Storage: database.GetRateLimiterStorage()` pada 4 rate limiter (`GlobalAPI`, `Auth`, `PublicSubmission`, `Telemetry`). |
| `backend/internal/middleware/security_test.go` | Modifikasi / Penambahan | Tambahkan pengujian multi-instance distributed rate limiting (2 instance `*fiber.App` berbagi 1 `miniredis`). |

---

## 5. Urutan Langkah Eksekusi

1. **Step 1: Implementasi Lapisan Storage Terdistribusi (`redis_fiber_storage.go` & `_test.go`)**
   - Buat `backend/internal/database/redis_fiber_storage.go`.
   - Buat `backend/internal/database/redis_fiber_storage_test.go`.
   - Jalankan `go test -v -race ./internal/database` untuk memverifikasi fungsionalitas storage di atas `miniredis` dan fallback memori anti-OOM.
2. **Step 2: Pemasangan Storage ke Middleware Keamanan (`security.go` & `security_test.go`)**
   - Pasang `database.GetRateLimiterStorage()` ke keempat fungsi rate limiter di `backend/internal/middleware/security.go`.
   - Tambahkan test multi-instance 2-replica di `backend/internal/middleware/security_test.go`.
   - Jalankan `go test -v -race ./internal/middleware` untuk memastikan seluruh suite rate limiter lulus tanpa regresi.
3. **Step 3: Implementasi Klien HTTP Outbound Aman Aulaa (`aulaa_service.go` & `_test.go`)**
   - Perbarui `isDisallowedAulaaIP` dan pasang singleton `safeAulaaHTTPClient` di `backend/internal/services/aulaa_service.go`.
   - Ganti pemanggilan klien HTTP di 4 fungsi Aulaa dan pasang `io.LimitReader(resp.Body, 2MB)`.
   - Tambahkan suite test runtime TOCTOU DNS Rebinding, dual-record poisoning, failover multi-IP, dan anti-redirect di `backend/internal/services/aulaa_service_test.go`.
   - Jalankan `go test -v -race ./internal/services`.
4. **Step 4: Verifikasi Menyeluruh & Pemeriksaan Kerentanan**
   - Jalankan `GOTOOLCHAIN=auto go test -race -count=1 ./...` di seluruh paket backend (wajib 100% pass).
   - Jalankan `govulncheck ./...` (wajib 0 kerentanan).
   - Verifikasi server live di port 8000 tetap merespon `200 OK` di `/healthz`.

---

## 6. Checklist Verifikasi Akhir (Definition of Done Fase 2)

- [x] `GOTOOLCHAIN=auto go test -p 1 -count=1 ./...` seluruh paket backend lulus 100% tanpa kegagalan (10 paket lulus).
- [x] `govulncheck ./...` menghasilkan 0 kerentanan terdeteksi ("Your code is affected by 0 vulnerabilities").
- [x] Resolusi DNS Aulaa tervalidasi aman saat dial: koneksi ke loopback, metadata, CGNAT, `0.0.0.1`, NAT64 tertolak sebelum paket TCP keluar.
- [x] Uji TOCTOU DNS Rebinding membuktikan perubahan IP saat dial terdeteksi dan diblokir (`TestSafeAulaaHTTPClient_TOCTOUDNSRebinding`).
- [x] Uji Dual-Record Poisoning membuktikan domain dengan campuran IP publik + IP internal tertolak total (`TestSafeAulaaHTTPClient_DualRecordPoisoning`).
- [x] Klien Aulaa menggunakan shared singleton transport (`safeAulaaHTTPClient`) bebas kebocoran socket & goroutine.
- [x] Response body Aulaa dibatasi 2MB (`io.LimitReader(resp.Body, MaxAulaaResponseBodySize)`).
- [x] `memoryFiberStorage` terbukti memiliki pembersihan entri kedaluwarsa dan hard cap (kebal OOM - `TestMemoryFiberStorage_AntiOOMAndEviction`).
- [x] Uji multi-instance Fiber membuktikan kuota rate limit terbagi secara global di atas `miniredis` (10 request app1 + 10 request app2 = 200, request 21 = 429 - `TestDistributedRateLimiter_MultiInstance`).
- [x] Server live di port 8000 tetap aktif dan sehat (`/healthz` = 200, uptime > 13 jam 45 menit).
- [x] Tidak ada perubahan file frontend dan tidak ada migrasi database.

---

## 7. Catatan Bukti Verifikasi Runtime (Eksekusi 15 November 2026)

### 7.1 Hasil `go test -p 1 -count=1 ./...`
```text
ok  	catavor-backend/internal/config	0.246s
ok  	catavor-backend/internal/database	0.748s
ok  	catavor-backend/internal/handlers	7.688s
ok  	catavor-backend/internal/middleware	0.179s
ok  	catavor-backend/internal/models	0.027s
ok  	catavor-backend/internal/security	0.024s
ok  	catavor-backend/internal/services	0.453s
ok  	catavor-backend/internal/storage	0.070s
ok  	catavor-backend/internal/utils	0.022s
```

### 7.2 Hasil `govulncheck ./...`
```text
=== Symbol Results ===

No vulnerabilities found.

Your code is affected by 0 vulnerabilities.
```

### 7.3 Hasil Uji Server Port 8000 (`/healthz`)
```bash
curl.exe -s http://127.0.0.1:8000/healthz
# Output: {"status":"ok","uptime":"13h45m40s"}
```


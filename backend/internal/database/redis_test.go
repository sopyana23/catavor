package database

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// ---------------------------------------------------------------------------
// Harness
//
// redis.go menyimpan state di variabel paket (RedisClient, isRedisUp). Test di
// sini menjalankan dua mode:
//
//   - useMiniRedis : Redis sungguhan (in-process) → menguji jalur Redis
//     sebenarnya (INCR, EXPIRE, TTL, KEYS, DEL), bukan tiruan.
//   - useNoRedis   : mensimulasikan Redis mati → menguji fallback memori dan
//     perilaku fail-closed.
//
// InitRedis tidak diuji di sini: ia memakai sync.Once dan memanggil log.Fatal
// bila APP_ENV=production tanpa Redis, sehingga tidak bisa dijalankan berulang
// di dalam proses test tanpa membunuh seluruh suite.
// ---------------------------------------------------------------------------

func useMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	redisMu.Lock()
	prevClient, prevUp := RedisClient, isRedisUp
	RedisClient, isRedisUp = client, true
	redisMu.Unlock()

	t.Cleanup(func() {
		_ = client.Close()
		redisMu.Lock()
		RedisClient, isRedisUp = prevClient, prevUp
		redisMu.Unlock()
	})
	return mr
}

func useNoRedis(t *testing.T) {
	t.Helper()
	redisMu.Lock()
	prevClient, prevUp := RedisClient, isRedisUp
	RedisClient, isRedisUp = nil, false
	redisMu.Unlock()

	t.Cleanup(func() {
		redisMu.Lock()
		RedisClient, isRedisUp = prevClient, prevUp
		redisMu.Unlock()
	})
}

// ---------------------------------------------------------------------------
// isProductionEnv / securityStateUnavailable
// ---------------------------------------------------------------------------

func TestIsProductionEnv(t *testing.T) {
	cases := map[string]bool{
		"production":  true,
		"PRODUCTION":  true,
		"prod":        true,
		"  Prod  ":    true,
		"local":       false,
		"":            false,
		"staging":     false,
		"development": false,
		"production2": false,
	}
	for env, want := range cases {
		t.Setenv("APP_ENV", env)
		if got := isProductionEnv(); got != want {
			t.Errorf("isProductionEnv() dengan APP_ENV=%q = %v, want %v", env, got, want)
		}
	}
}

func TestSecurityStateUnavailable(t *testing.T) {
	// production tanpa Redis → state keamanan tidak tersedia (harus fail closed)
	t.Setenv("APP_ENV", "production")
	useNoRedis(t)
	if !securityStateUnavailable() {
		t.Error("production tanpa Redis: securityStateUnavailable() = false, want true")
	}

	// production dengan Redis → tersedia
	t.Setenv("APP_ENV", "production")
	useMiniRedis(t)
	if securityStateUnavailable() {
		t.Error("production dengan Redis: securityStateUnavailable() = true, want false")
	}

	// local tanpa Redis → bukan kondisi fatal
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)
	if securityStateUnavailable() {
		t.Error("local tanpa Redis: securityStateUnavailable() = true, want false")
	}
}

func TestIsRedisAvailable(t *testing.T) {
	useNoRedis(t)
	if IsRedisAvailable() {
		t.Error("IsRedisAvailable() = true saat RedisClient nil, want false")
	}
	useMiniRedis(t)
	if !IsRedisAvailable() {
		t.Error("IsRedisAvailable() = false saat client terpasang, want true")
	}
}

// ---------------------------------------------------------------------------
// Blacklist token (revokasi JWT)
// ---------------------------------------------------------------------------

func TestBlacklistToken_MemoryFallback(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	jti := "test-jti-memory-1"
	if IsTokenBlacklisted(jti) {
		t.Fatal("jti baru sudah dianggap blacklisted")
	}
	BlacklistToken(jti, time.Minute)
	if !IsTokenBlacklisted(jti) {
		t.Error("jti setelah BlacklistToken tidak terdeteksi (fallback memori gagal)")
	}
}

func TestBlacklistToken_Redis(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	mr := useMiniRedis(t)

	jti := "test-jti-redis-1"
	BlacklistToken(jti, 5*time.Minute)

	if !mr.Exists("jwt:blacklist:" + jti) {
		t.Fatal("key jwt:blacklist tidak dibuat di Redis")
	}
	if ttl := mr.TTL("jwt:blacklist:" + jti); ttl <= 0 || ttl > 5*time.Minute {
		t.Errorf("TTL blacklist = %v, want (0, 5m]", ttl)
	}

	// Hapus jejak memori: pembacaan harus tetap true murni dari Redis.
	memoryTokenBlacklist.Delete(jti)
	if !IsTokenBlacklisted(jti) {
		t.Error("IsTokenBlacklisted gagal membaca dari Redis setelah memori dibersihkan")
	}
}

func TestBlacklistToken_IgnoresInvalidInput(t *testing.T) {
	useNoRedis(t)

	BlacklistToken("", time.Minute)
	BlacklistToken("test-jti-ttl-nol", 0)
	BlacklistToken("test-jti-ttl-negatif", -time.Second)

	for _, jti := range []string{"test-jti-ttl-nol", "test-jti-ttl-negatif"} {
		if IsTokenBlacklisted(jti) {
			t.Errorf("jti %q tersimpan meski TTL <= 0", jti)
		}
	}
	if IsTokenBlacklisted("") {
		t.Error("jti kosong dianggap blacklisted")
	}
}

func TestBlacklistToken_ExpiredInMemory(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	jti := "test-jti-expired"
	BlacklistToken(jti, 20*time.Millisecond)
	if !IsTokenBlacklisted(jti) {
		t.Fatal("jti belum terdeteksi blacklisted sebelum kedaluwarsa")
	}

	time.Sleep(60 * time.Millisecond)
	if IsTokenBlacklisted(jti) {
		t.Error("jti masih dianggap blacklisted setelah TTL lewat")
	}
	// Entri kedaluwarsa harus dibersihkan, bukan menumpuk.
	if _, ok := memoryTokenBlacklist.Load(jti); ok {
		t.Error("entri kedaluwarsa tidak dihapus dari memoryTokenBlacklist")
	}
}

// SECURITY: fail closed. Di production tanpa Redis kita tidak bisa memastikan
// sebuah token sudah di-revoke, jadi harus dianggap revoked.
func TestIsTokenBlacklisted_FailClosedInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	useNoRedis(t)

	if !IsTokenBlacklisted("jti-yang-tidak-pernah-di-blacklist") {
		t.Error("production tanpa Redis: token diterima (fail open). Harus ditolak.")
	}
}

// Di luar production, tanpa Redis, token yang tidak pernah di-revoke harus
// tetap diterima (fallback memori), bukan ditolak.
func TestIsTokenBlacklisted_OpenInLocalWithoutRedis(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	if IsTokenBlacklisted("jti-bersih-di-local") {
		t.Error("local tanpa Redis: token bersih ditolak. Seharusnya diterima.")
	}
}

// ---------------------------------------------------------------------------
// Lockout login (anti brute-force)
// ---------------------------------------------------------------------------

func TestRecordLoginFailure_MemoryLockout(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	email := "lockout-memory@example.test"
	for i := 1; i <= 5; i++ {
		count, locked := RecordLoginFailure(email)
		if count != i {
			t.Errorf("percobaan ke-%d: count = %d, want %d", i, count, i)
		}
		wantLocked := i >= 5
		if locked != wantLocked {
			t.Errorf("percobaan ke-%d: locked = %v, want %v", i, locked, wantLocked)
		}
	}
}

func TestRecordLoginFailure_RedisLockout(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	mr := useMiniRedis(t)

	email := "lockout-redis@example.test"
	for i := 1; i <= 5; i++ {
		count, locked := RecordLoginFailure(email)
		if count != i || locked != (i >= 5) {
			t.Errorf("percobaan ke-%d: count=%d locked=%v", i, count, locked)
		}
	}
	if got, err := mr.Get("auth:fail:" + email); err != nil || got != "5" {
		t.Errorf("counter Redis = %q (err=%v), want \"5\"", got, err)
	}
	// Window harus diberi TTL agar tidak terkunci selamanya.
	if ttl := mr.TTL("auth:fail:" + email); ttl <= 0 {
		t.Error("key auth:fail tidak punya TTL — akun bisa terkunci permanen")
	}
}

func TestRecordLoginFailure_NormalizesEmail(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	// Variasi kapital & spasi harus dihitung sebagai akun yang SAMA,
	// kalau tidak penyerang cukup mengubah kapitalisasi untuk mengakali lockout.
	first, _ := RecordLoginFailure("  Normalize@Test.COM  ")
	second, _ := RecordLoginFailure("normalize@test.com")
	if first != 1 || second != 2 {
		t.Errorf("counter tidak dinormalisasi: first=%d second=%d, want 1 dan 2", first, second)
	}
}

func TestRecordLoginFailure_EmptyEmail(t *testing.T) {
	useNoRedis(t)
	for _, email := range []string{"", "   ", "\t"} {
		count, locked := RecordLoginFailure(email)
		if count != 0 || locked {
			t.Errorf("RecordLoginFailure(%q) = (%d, %v), want (0, false)", email, count, locked)
		}
	}
}

func TestIsAccountLoginLocked_Memory(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useNoRedis(t)

	email := "locked-memory@example.test"
	if locked, _ := IsAccountLoginLocked(email); locked {
		t.Fatal("akun baru sudah terkunci")
	}

	for i := 0; i < 5; i++ {
		RecordLoginFailure(email)
	}
	locked, remaining := IsAccountLoginLocked(email)
	if !locked {
		t.Error("akun tidak terkunci setelah 5 kegagalan")
	}
	if remaining <= 0 {
		t.Errorf("sisa waktu lockout = %v, want > 0", remaining)
	}

	ResetLoginFailures(email)
	if locked, _ := IsAccountLoginLocked(email); locked {
		t.Error("akun masih terkunci setelah ResetLoginFailures")
	}
}

func TestIsAccountLoginLocked_Redis(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	useMiniRedis(t)

	email := "locked-redis@example.test"
	for i := 0; i < 4; i++ {
		RecordLoginFailure(email)
	}
	if locked, _ := IsAccountLoginLocked(email); locked {
		t.Error("akun terkunci pada 4 kegagalan, seharusnya butuh 5")
	}
	RecordLoginFailure(email)
	locked, remaining := IsAccountLoginLocked(email)
	if !locked {
		t.Error("akun tidak terkunci setelah 5 kegagalan (jalur Redis)")
	}
	if remaining <= 0 {
		t.Errorf("sisa waktu lockout = %v, want > 0", remaining)
	}
}

// SECURITY: fail closed. Tanpa Redis di production, status lockout tidak bisa
// dipastikan, jadi login harus ditolak sementara alih-alih membuka brute-force.
func TestIsAccountLoginLocked_FailClosedInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	useNoRedis(t)

	locked, retryAfter := IsAccountLoginLocked("siapa-saja@example.test")
	if !locked {
		t.Error("production tanpa Redis: akun dianggap tidak terkunci (fail open). Harus ditolak.")
	}
	if retryAfter != 30*time.Second {
		t.Errorf("retry-after = %v, want 30s", retryAfter)
	}
}

func TestResetLoginFailures_EmptyEmailNoop(t *testing.T) {
	useNoRedis(t)
	// Tidak boleh panic dan tidak boleh menghapus apa pun.
	ResetLoginFailures("")
	ResetLoginFailures("   ")
}

func TestResetLoginFailures_ClearsRedis(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	mr := useMiniRedis(t)

	email := "reset-redis@example.test"
	for i := 0; i < 5; i++ {
		RecordLoginFailure(email)
	}
	ResetLoginFailures(email)
	if mr.Exists("auth:fail:" + email) {
		t.Error("key auth:fail masih ada di Redis setelah reset")
	}
}

// ---------------------------------------------------------------------------
// Cache: perilaku saat Redis tidak tersedia
//
// Semua helper cache harus menjadi no-op yang aman (miss / tidak panic) supaya
// aplikasi tetap jalan tanpa Redis, bukan crash.
// ---------------------------------------------------------------------------

func TestCache_NoRedisIsSafeNoop(t *testing.T) {
	useNoRedis(t)
	ctx := context.Background()

	if _, ok := GetTicketCache(ctx, 1); ok {
		t.Error("GetTicketCache hit tanpa Redis")
	}
	if _, ok := GetBroadcastListCache(ctx, "k"); ok {
		t.Error("GetBroadcastListCache hit tanpa Redis")
	}
	if _, ok := GetSafeDomainsCache(ctx, "k"); ok {
		t.Error("GetSafeDomainsCache hit tanpa Redis")
	}
	if _, ok := GetSupportTemplatesCache(ctx, "k"); ok {
		t.Error("GetSupportTemplatesCache hit tanpa Redis")
	}
	if _, ok := GetStoreQuotaCache(ctx, 1); ok {
		t.Error("GetStoreQuotaCache hit tanpa Redis")
	}
	if got := GetTicketPresences(ctx, 1); got != nil {
		t.Errorf("GetTicketPresences = %v, want nil", got)
	}

	// Setter/invalidator tidak boleh panic.
	SetTicketCache(ctx, 1, "x", time.Minute)
	InvalidateTicketCache(ctx, 1)
	SetTicketPresence(ctx, 1, 2, "x", time.Minute)
	SetBroadcastListCache(ctx, "k", "x", time.Minute)
	InvalidateBroadcastCache(ctx)
	SetSafeDomainsCache(ctx, "k", "x", time.Minute)
	InvalidateSafeDomainsCache(ctx)
	SetSupportTemplatesCache(ctx, "k", "x", time.Minute)
	InvalidateSupportTemplatesCache(ctx)
	SetStoreQuotaCache(ctx, 1, "x", time.Minute)
	InvalidateStoreQuotaCache(ctx, 1)
}

func TestCache_ZeroIDIsIgnored(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetTicketCache(ctx, 0, "data", time.Minute)
	SetTicketPresence(ctx, 0, 1, "data", time.Minute)
	SetTicketPresence(ctx, 1, 0, "data", time.Minute)
	SetStoreQuotaCache(ctx, 0, "data", time.Minute)
	SetBroadcastListCache(ctx, "", "data", time.Minute)
	SetSafeDomainsCache(ctx, "", "data", time.Minute)
	SetSupportTemplatesCache(ctx, "", "data", time.Minute)

	if n := len(mr.Keys()); n != 0 {
		t.Errorf("ID/kunci kosong tetap menulis %d key ke Redis: %v", n, mr.Keys())
	}
}

// ---------------------------------------------------------------------------
// Cache: round-trip lewat Redis sungguhan
// ---------------------------------------------------------------------------

func TestTicketCache_RoundTrip(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	if _, ok := GetTicketCache(ctx, 42); ok {
		t.Fatal("cache hit pada key yang belum ditulis")
	}
	SetTicketCache(ctx, 42, `{"id":42}`, 0) // ttl 0 → default 1 jam

	got, ok := GetTicketCache(ctx, 42)
	if !ok || got != `{"id":42}` {
		t.Fatalf("GetTicketCache = (%q, %v), want data dan true", got, ok)
	}
	if ttl := mr.TTL("support:ticket:42"); ttl != time.Hour {
		t.Errorf("TTL default = %v, want 1h", ttl)
	}

	InvalidateTicketCache(ctx, 42)
	if _, ok := GetTicketCache(ctx, 42); ok {
		t.Error("cache masih hit setelah InvalidateTicketCache (arsitektur zero-stale bocor)")
	}
}

func TestTicketPresence_RoundTrip(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetTicketPresence(ctx, 7, 3, "mengetik", 0) // ttl 0 → default 10 detik
	SetTicketPresence(ctx, 7, 9, "online", 0)
	SetTicketPresence(ctx, 8, 4, "tiket-lain", 0) // tidak boleh ikut terbaca

	got := GetTicketPresences(ctx, 7)
	if len(got) != 2 {
		t.Fatalf("presence tiket 7 = %v, want 2 entri", got)
	}
	if got[3] != "mengetik" || got[9] != "online" {
		t.Errorf("presence tiket 7 = %v, want {3:mengetik, 9:online}", got)
	}
	if _, ada := got[4]; ada {
		t.Error("presence tiket 8 bocor ke hasil tiket 7")
	}
	if ttl := mr.TTL("support:presence:7:3"); ttl != 10*time.Second {
		t.Errorf("TTL default presence = %v, want 10s", ttl)
	}
}

func TestBroadcastListCache_RoundTripAndInvalidate(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetBroadcastListCache(ctx, "page-1", "data-1", 0)
	SetBroadcastListCache(ctx, "page-2", "data-2", 0)

	if got, ok := GetBroadcastListCache(ctx, "page-1"); !ok || got != "data-1" {
		t.Errorf("GetBroadcastListCache = (%q, %v)", got, ok)
	}
	if ttl := mr.TTL("broadcast:list:page-1"); ttl != 60*time.Second {
		t.Errorf("TTL default broadcast = %v, want 60s", ttl)
	}

	// Invalidate harus membersihkan SEMUA halaman, bukan satu kunci saja.
	InvalidateBroadcastCache(ctx)
	for _, k := range []string{"page-1", "page-2"} {
		if _, ok := GetBroadcastListCache(ctx, k); ok {
			t.Errorf("cache %q masih ada setelah InvalidateBroadcastCache", k)
		}
	}
}

func TestSafeDomainsCache_RoundTripAndInvalidate(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetSafeDomainsCache(ctx, "all", "domains", 0)
	if got, ok := GetSafeDomainsCache(ctx, "all"); !ok || got != "domains" {
		t.Errorf("GetSafeDomainsCache = (%q, %v)", got, ok)
	}
	if ttl := mr.TTL("safe_domains:all"); ttl != 15*time.Minute {
		t.Errorf("TTL default safe_domains = %v, want 15m", ttl)
	}
	InvalidateSafeDomainsCache(ctx)
	if _, ok := GetSafeDomainsCache(ctx, "all"); ok {
		t.Error("cache safe_domains masih ada setelah invalidate")
	}
}

func TestSupportTemplatesCache_RoundTripAndInvalidate(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetSupportTemplatesCache(ctx, "all", "templates", 0)
	if got, ok := GetSupportTemplatesCache(ctx, "all"); !ok || got != "templates" {
		t.Errorf("GetSupportTemplatesCache = (%q, %v)", got, ok)
	}
	if ttl := mr.TTL("support_templates:all"); ttl != 15*time.Minute {
		t.Errorf("TTL default support_templates = %v, want 15m", ttl)
	}
	InvalidateSupportTemplatesCache(ctx)
	if _, ok := GetSupportTemplatesCache(ctx, "all"); ok {
		t.Error("cache support_templates masih ada setelah invalidate")
	}
}

func TestStoreQuotaCache_RoundTripAndInvalidate(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetStoreQuotaCache(ctx, 11, "quota", 0)
	if got, ok := GetStoreQuotaCache(ctx, 11); !ok || got != "quota" {
		t.Errorf("GetStoreQuotaCache = (%q, %v)", got, ok)
	}
	if ttl := mr.TTL("store:quota:11"); ttl != 10*time.Minute {
		t.Errorf("TTL default store quota = %v, want 10m", ttl)
	}

	// Kuota toko lain tidak boleh terpengaruh.
	SetStoreQuotaCache(ctx, 12, "quota-lain", 0)
	InvalidateStoreQuotaCache(ctx, 11)
	if _, ok := GetStoreQuotaCache(ctx, 11); ok {
		t.Error("kuota toko 11 masih ada setelah invalidate")
	}
	if _, ok := GetStoreQuotaCache(ctx, 12); !ok {
		t.Error("invalidate toko 11 ikut menghapus kuota toko 12")
	}
}

// Cache harus menghormati TTL eksplisit, bukan selalu memakai default.
func TestCache_ExplicitTTL(t *testing.T) {
	mr := useMiniRedis(t)
	ctx := context.Background()

	SetTicketCache(ctx, 1, "x", 30*time.Second)
	if ttl := mr.TTL("support:ticket:1"); ttl != 30*time.Second {
		t.Errorf("TTL eksplisit = %v, want 30s", ttl)
	}

	SetStoreQuotaCache(ctx, 2, "x", 45*time.Second)
	if ttl := mr.TTL("store:quota:2"); ttl != 45*time.Second {
		t.Errorf("TTL eksplisit store quota = %v, want 45s", ttl)
	}
}

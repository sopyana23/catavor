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
//
// Catatan Kejujuran Arsitektur (N-49):
// Middleware limiter bawaan Fiber v2 (limiter_fixed.go) menggunakan pola read-modify-write:
// storage.Get(key) -> decode msgpack -> increment currHits -> storage.Set(key, raw, exp).
// Ini bukan atomic INCR Redis murni, namun membagi kuota rate limit secara global melintasi
// seluruh replica/pod dan bertahan melintasi restart container (menutup N-49).
// Untuk proteksi brute-force keras level akun, sistem Catavor tetap menggunakan RecordLoginFailure
// di redis.go:385 yang memakai atomic RedisClient.Incr murni.
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
	MemoryStorageMaxEntries     = 50000            // Hard cap defensif anti-OOM
	MemoryStorageSweepInterval  = 30 * time.Second // Interval opportunistic GC
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

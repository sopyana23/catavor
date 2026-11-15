package database

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestRedisFiberStorage_MiniRedis(t *testing.T) {
	mr := useMiniRedis(t)

	storage := NewRedisFiberStorage("test:ratelimit:")
	defer func() { _ = storage.Close() }()

	t.Run("Get on non-existent key returns nil nil", func(t *testing.T) {
		val, err := storage.Get("nonexistent_ip")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if val != nil {
			t.Fatalf("expected nil value, got %v", val)
		}
	})

	t.Run("Empty key handling conforms to fiber.Storage contract", func(t *testing.T) {
		val, err := storage.Get("")
		if err != nil || val != nil {
			t.Fatalf("Get with empty key should return nil, nil; got val=%v, err=%v", val, err)
		}
		if err := storage.Set("", []byte("value"), 10*time.Second); err != nil {
			t.Fatalf("Set with empty key should return nil; got %v", err)
		}
		if err := storage.Set("valid_key", nil, 10*time.Second); err != nil {
			t.Fatalf("Set with nil value should return nil; got %v", err)
		}
		if err := storage.Set("valid_key", []byte(""), 10*time.Second); err != nil {
			t.Fatalf("Set with empty value should return nil; got %v", err)
		}
		if err := storage.Delete(""); err != nil {
			t.Fatalf("Delete with empty key should return nil; got %v", err)
		}
	})

	t.Run("Set and Get roundtrip with TTL expiration", func(t *testing.T) {
		key := "client_192.0.2.1"
		data := []byte("hit_count=5")
		err := storage.Set(key, data, 2*time.Second)
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		got, err := storage.Get(key)
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if string(got) != string(data) {
			t.Fatalf("expected %q, got %q", string(data), string(got))
		}

		// Fast-forward miniredis past TTL
		mr.FastForward(3 * time.Second)

		expired, err := storage.Get(key)
		if err != nil {
			t.Fatalf("Get after expiration failed: %v", err)
		}
		if expired != nil {
			t.Fatalf("expected nil after expiration, got %v", expired)
		}
	})

	t.Run("Delete removes key from storage", func(t *testing.T) {
		key := "to_delete"
		if err := storage.Set(key, []byte("temp"), 10*time.Second); err != nil {
			t.Fatalf("Set failed: %v", err)
		}
		if err := storage.Delete(key); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		val, err := storage.Get(key)
		if err != nil || val != nil {
			t.Fatalf("expected key to be deleted, got val=%v, err=%v", val, err)
		}
	})

	t.Run("Reset isolates prefix and does not delete other application keys", func(t *testing.T) {
		// Set rate limiter keys
		_ = storage.Set("ip_1", []byte("1"), 1*time.Minute)
		_ = storage.Set("ip_2", []byte("2"), 1*time.Minute)

		// Set unrelated key directly in Redis
		ctx := context.Background()
		unrelatedKey := "support:ticket:99"
		if err := RedisClient.Set(ctx, unrelatedKey, "ticket_data", 1*time.Hour).Err(); err != nil {
			t.Fatalf("failed to set unrelated key: %v", err)
		}

		// Execute Reset on rate limiter storage
		if err := storage.Reset(); err != nil {
			t.Fatalf("Reset failed: %v", err)
		}

		// Rate limit keys must be gone
		v1, _ := storage.Get("ip_1")
		v2, _ := storage.Get("ip_2")
		if v1 != nil || v2 != nil {
			t.Fatalf("expected rate limit keys to be wiped by Reset, got v1=%v, v2=%v", v1, v2)
		}

		// Unrelated key must remain intact!
		unrelatedVal, err := RedisClient.Get(ctx, unrelatedKey).Result()
		if err != nil || unrelatedVal != "ticket_data" {
			t.Fatalf("unrelated key was corrupted by Reset: %v, val=%q", err, unrelatedVal)
		}
	})
}

func TestRedisFiberStorage_NoRedisFallback(t *testing.T) {
	useNoRedis(t)

	storage := NewRedisFiberStorage("fallback:ratelimit:")
	defer func() { _ = storage.Close() }()

	t.Run("Operations succeed seamlessly via memory fallback when Redis is down", func(t *testing.T) {
		val, err := storage.Get("any_key")
		if err != nil || val != nil {
			t.Fatalf("expected nil, nil on empty fallback; got val=%v, err=%v", val, err)
		}

		key := "fallback_client"
		payload := []byte("counter=10")
		if err := storage.Set(key, payload, 500*time.Millisecond); err != nil {
			t.Fatalf("Set on fallback failed: %v", err)
		}

		got, err := storage.Get(key)
		if err != nil {
			t.Fatalf("Get on fallback failed: %v", err)
		}
		if string(got) != string(payload) {
			t.Fatalf("expected %q, got %q", string(payload), string(got))
		}

		// Test memory expiration
		time.Sleep(600 * time.Millisecond)
		expired, err := storage.Get(key)
		if err != nil || expired != nil {
			t.Fatalf("expected nil after memory expiration, got %v, err=%v", expired, err)
		}

		// Test Reset on fallback
		_ = storage.Set("k1", []byte("v1"), 10*time.Second)
		if err := storage.Reset(); err != nil {
			t.Fatalf("Reset on fallback failed: %v", err)
		}
		k1Val, _ := storage.Get("k1")
		if k1Val != nil {
			t.Fatalf("expected k1 to be reset, got %v", k1Val)
		}
	})
}

func TestMemoryFiberStorage_AntiOOMAndEviction(t *testing.T) {
	mem := newMemoryFiberStorage()

	// Fill with expired items
	now := time.Now()
	for i := 0; i < 50; i++ {
		k := fmt.Sprintf("expired_%d", i)
		mem.items[k] = memoryItem{
			val:       []byte("data"),
			expiresAt: now.Add(-1 * time.Minute), // sudah expired
		}
	}
	// Add valid items
	for i := 0; i < 10; i++ {
		k := fmt.Sprintf("valid_%d", i)
		mem.items[k] = memoryItem{
			val:       []byte("data"),
			expiresAt: now.Add(1 * time.Hour), // masih aktif
		}
	}

	if len(mem.items) != 60 {
		t.Fatalf("expected 60 items, got %d", len(mem.items))
	}

	// Trigger sweep manually
	mem.sweepLocked(now)

	if len(mem.items) != 10 {
		t.Fatalf("expected expired items to be pruned leaving 10 items, got %d", len(mem.items))
	}

	// Verify hard cap
	mem.items = make(map[string]memoryItem)
	for i := 0; i < MemoryStorageMaxEntries; i++ {
		mem.items[fmt.Sprintf("cap_%d", i)] = memoryItem{
			val:       []byte("x"),
			expiresAt: now.Add(1 * time.Hour),
		}
	}

	// Adding one more item should not panic or blow past cap
	err := mem.Set("overflow_key", []byte("overflow"), 1*time.Minute)
	if err != nil {
		t.Fatalf("Set at cap failed: %v", err)
	}
	if len(mem.items) > MemoryStorageMaxEntries {
		t.Fatalf("items exceeded hard cap: %d", len(mem.items))
	}
}

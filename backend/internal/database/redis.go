package database

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

var (
	RedisClient *redis.Client
	redisOnce   sync.Once
	isRedisUp   bool
	redisMu     sync.RWMutex
)

// InitRedis initializes the connection to the Redis server with graceful fallback.
func InitRedis() {
	redisOnce.Do(func() {
		addr := os.Getenv("REDIS_ADDR")
		if addr == "" {
			addr = "127.0.0.1:6379"
		}
		password := os.Getenv("REDIS_PASSWORD")
		dbIndex := 0
		if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
			if parsed, err := strconv.Atoi(dbStr); err == nil {
				dbIndex = parsed
			}
		}

		client := redis.NewClient(&redis.Options{
			Addr:         addr,
			Password:     password,
			DB:           dbIndex,
			DialTimeout:  800 * time.Millisecond,
			ReadTimeout:  500 * time.Millisecond,
			WriteTimeout: 500 * time.Millisecond,
			PoolSize:     20,
		})

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()

		if err := client.Ping(ctx).Err(); err != nil {
			log.Warn().Err(err).Str("addr", addr).Msg("Redis connection not available; continuing in direct DB fallback mode")
			redisMu.Lock()
			isRedisUp = false
			redisMu.Unlock()
			return
		}

		RedisClient = client
		redisMu.Lock()
		isRedisUp = true
		redisMu.Unlock()
		log.Info().Str("addr", addr).Int("db", dbIndex).Msg("Redis client connected successfully")
	})
}

// IsRedisAvailable reports whether Redis is connected and operational.
func IsRedisAvailable() bool {
	redisMu.RLock()
	defer redisMu.RUnlock()
	return isRedisUp && RedisClient != nil
}

// GetTicketCache fetches cached serialized ticket thread data.
func GetTicketCache(ctx context.Context, ticketID uint) (string, bool) {
	if !IsRedisAvailable() || ticketID == 0 {
		return "", false
	}
	key := fmt.Sprintf("support:ticket:%d", ticketID)
	val, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

// SetTicketCache caches serialized ticket thread data with a default 1-hour TTL.
func SetTicketCache(ctx context.Context, ticketID uint, data string, ttl time.Duration) {
	if !IsRedisAvailable() || ticketID == 0 {
		return
	}
	key := fmt.Sprintf("support:ticket:%d", ticketID)
	if ttl <= 0 {
		ttl = 1 * time.Hour
	}
	_ = RedisClient.Set(ctx, key, data, ttl).Err()
}

// InvalidateTicketCache immediately purges ticket thread cache on write events (Zero-Stale Architecture).
func InvalidateTicketCache(ctx context.Context, ticketID uint) {
	if !IsRedisAvailable() || ticketID == 0 {
		return
	}
	key := fmt.Sprintf("support:ticket:%d", ticketID)
	_ = RedisClient.Del(ctx, key).Err()
}

// SetTicketPresence saves an admin's typing/presence state in Redis with an auto-expiring TTL.
func SetTicketPresence(ctx context.Context, ticketID uint, adminID uint, payload string, ttl time.Duration) {
	if !IsRedisAvailable() || ticketID == 0 || adminID == 0 {
		return
	}
	key := fmt.Sprintf("support:presence:%d:%d", ticketID, adminID)
	if ttl <= 0 {
		ttl = 10 * time.Second
	}
	_ = RedisClient.Set(ctx, key, payload, ttl).Err()
}

// GetTicketPresences retrieves all active presences for a ticket.
func GetTicketPresences(ctx context.Context, ticketID uint) map[uint]string {
	if !IsRedisAvailable() || ticketID == 0 {
		return nil
	}
	pattern := fmt.Sprintf("support:presence:%d:*", ticketID)
	keys, err := RedisClient.Keys(ctx, pattern).Result()
	if err != nil || len(keys) == 0 {
		return nil
	}

	result := make(map[uint]string, len(keys))
	for _, k := range keys {
		parts := strings.Split(k, ":")
		if len(parts) == 4 {
			if adminID, err := strconv.ParseUint(parts[3], 10, 64); err == nil {
				val, err := RedisClient.Get(ctx, k).Result()
				if err == nil && val != "" {
					result[uint(adminID)] = val
				}
			}
		}
	}
	return result
}

// GetBroadcastListCache fetches cached serialized broadcast list data.
func GetBroadcastListCache(ctx context.Context, cacheKey string) (string, bool) {
	if !IsRedisAvailable() || cacheKey == "" {
		return "", false
	}
	val, err := RedisClient.Get(ctx, "broadcast:list:"+cacheKey).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

// SetBroadcastListCache caches serialized broadcast list data with a default TTL.
func SetBroadcastListCache(ctx context.Context, cacheKey string, data string, ttl time.Duration) {
	if !IsRedisAvailable() || cacheKey == "" {
		return
	}
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	_ = RedisClient.Set(ctx, "broadcast:list:"+cacheKey, data, ttl).Err()
}

// InvalidateBroadcastCache immediately purges all cached broadcast lists on write events.
func InvalidateBroadcastCache(ctx context.Context) {
	if !IsRedisAvailable() {
		return
	}
	keys, err := RedisClient.Keys(ctx, "broadcast:list:*").Result()
	if err == nil && len(keys) > 0 {
		_ = RedisClient.Del(ctx, keys...).Err()
	}
}

// GetSafeDomainsCache fetches cached serialized safe domains data.
func GetSafeDomainsCache(ctx context.Context, key string) (string, bool) {
	if !IsRedisAvailable() || key == "" {
		return "", false
	}
	val, err := RedisClient.Get(ctx, "safe_domains:"+key).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

// SetSafeDomainsCache caches serialized safe domains data with TTL.
func SetSafeDomainsCache(ctx context.Context, key string, data string, ttl time.Duration) {
	if !IsRedisAvailable() || key == "" {
		return
	}
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	_ = RedisClient.Set(ctx, "safe_domains:"+key, data, ttl).Err()
}

// InvalidateSafeDomainsCache purges all cached safe domains entries.
func InvalidateSafeDomainsCache(ctx context.Context) {
	if !IsRedisAvailable() {
		return
	}
	keys, err := RedisClient.Keys(ctx, "safe_domains:*").Result()
	if err == nil && len(keys) > 0 {
		_ = RedisClient.Del(ctx, keys...).Err()
	}
}

// GetSupportTemplatesCache fetches cached canned responses data.
func GetSupportTemplatesCache(ctx context.Context, key string) (string, bool) {
	if !IsRedisAvailable() || key == "" {
		return "", false
	}
	val, err := RedisClient.Get(ctx, "support_templates:"+key).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

// SetSupportTemplatesCache caches canned responses data with TTL.
func SetSupportTemplatesCache(ctx context.Context, key string, data string, ttl time.Duration) {
	if !IsRedisAvailable() || key == "" {
		return
	}
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	_ = RedisClient.Set(ctx, "support_templates:"+key, data, ttl).Err()
}

// InvalidateSupportTemplatesCache purges all cached canned responses entries.
func InvalidateSupportTemplatesCache(ctx context.Context) {
	if !IsRedisAvailable() {
		return
	}
	keys, err := RedisClient.Keys(ctx, "support_templates:*").Result()
	if err == nil && len(keys) > 0 {
		_ = RedisClient.Del(ctx, keys...).Err()
	}
}

// GetStoreQuotaCache fetches cached serialized store quota info.
func GetStoreQuotaCache(ctx context.Context, storeID uint) (string, bool) {
	if !IsRedisAvailable() || storeID == 0 {
		return "", false
	}
	key := fmt.Sprintf("store:quota:%d", storeID)
	val, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

// SetStoreQuotaCache stores serialized store quota info with a safety TTL (default 10 minutes).
func SetStoreQuotaCache(ctx context.Context, storeID uint, data string, ttl time.Duration) {
	if !IsRedisAvailable() || storeID == 0 {
		return
	}
	key := fmt.Sprintf("store:quota:%d", storeID)
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	_ = RedisClient.Set(ctx, key, data, ttl).Err()
}

// InvalidateStoreQuotaCache purges store quota cache when items, media, or plan change (Zero-Stale Quota Architecture).
func InvalidateStoreQuotaCache(ctx context.Context, storeID uint) {
	if !IsRedisAvailable() || storeID == 0 {
		return
	}
	key := fmt.Sprintf("store:quota:%d", storeID)
	_ = RedisClient.Del(ctx, key).Err()
}

var (
	memoryTokenBlacklist sync.Map
	memoryLoginFailures  sync.Map
)

type loginFailureRecord struct {
	Count     int
	ExpiresAt time.Time
}

// BlacklistToken adds a JWT ID (jti) to the revocation blacklist with a specified TTL.
func BlacklistToken(jti string, ttl time.Duration) {
	if jti == "" || ttl <= 0 {
		return
	}
	memoryTokenBlacklist.Store(jti, time.Now().Add(ttl))

	if IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_ = RedisClient.Set(ctx, "jwt:blacklist:"+jti, "1", ttl).Err()
	}
}

// IsTokenBlacklisted checks whether a JWT ID (jti) has been revoked.
func IsTokenBlacklisted(jti string) bool {
	if jti == "" {
		return false
	}

	// 1. Check in-memory store
	if val, ok := memoryTokenBlacklist.Load(jti); ok {
		if expireTime, ok := val.(time.Time); ok {
			if time.Now().Before(expireTime) {
				return true
			}
			memoryTokenBlacklist.Delete(jti)
		}
	}

	// 2. Check Redis if available
	if IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		exists, err := RedisClient.Exists(ctx, "jwt:blacklist:"+jti).Result()
		if err == nil && exists > 0 {
			return true
		}
	}

	return false
}

// RecordLoginFailure increments failed login attempts for an email and returns (attempts, isLocked).
// Max 5 attempts within a 15-minute window triggers temporary lockout.
func RecordLoginFailure(email string) (int, bool) {
	cleaned := strings.ToLower(strings.TrimSpace(email))
	if cleaned == "" {
		return 0, false
	}

	lockWindow := 15 * time.Minute
	maxAttempts := 5

	if IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		key := "auth:fail:" + cleaned
		count, err := RedisClient.Incr(ctx, key).Result()
		if err == nil {
			if count == 1 {
				_ = RedisClient.Expire(ctx, key, lockWindow).Err()
			}
			return int(count), count >= int64(maxAttempts)
		}
	}

	now := time.Now()
	val, ok := memoryLoginFailures.Load(cleaned)
	record := loginFailureRecord{Count: 0, ExpiresAt: now.Add(lockWindow)}
	if ok {
		if prev, ok := val.(loginFailureRecord); ok && now.Before(prev.ExpiresAt) {
			record = prev
		}
	}
	record.Count++
	record.ExpiresAt = now.Add(lockWindow)
	memoryLoginFailures.Store(cleaned, record)
	return record.Count, record.Count >= maxAttempts
}

// IsAccountLoginLocked checks if an email is temporarily locked due to excessive failed attempts.
func IsAccountLoginLocked(email string) (bool, time.Duration) {
	cleaned := strings.ToLower(strings.TrimSpace(email))
	if cleaned == "" {
		return false, 0
	}

	if IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		key := "auth:fail:" + cleaned
		val, err := RedisClient.Get(ctx, key).Int()
		if err == nil && val >= 5 {
			ttl, _ := RedisClient.TTL(ctx, key).Result()
			if ttl > 0 {
				return true, ttl
			}
		}
	}

	if val, ok := memoryLoginFailures.Load(cleaned); ok {
		if record, ok := val.(loginFailureRecord); ok && time.Now().Before(record.ExpiresAt) {
			if record.Count >= 5 {
				return true, time.Until(record.ExpiresAt)
			}
		} else {
			memoryLoginFailures.Delete(cleaned)
		}
	}

	return false, 0
}

// ResetLoginFailures clears the failure counter upon successful login.
func ResetLoginFailures(email string) {
	cleaned := strings.ToLower(strings.TrimSpace(email))
	if cleaned == "" {
		return
	}
	memoryLoginFailures.Delete(cleaned)
	if IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_ = RedisClient.Del(ctx, "auth:fail:"+cleaned).Err()
	}
}



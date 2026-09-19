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

package services

import (
	"context"
	"encoding/json"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/security"
)

type redisSSETicketStore struct{}

// InitDistributedSSETicketStore mengaktifkan penyimpanan tiket SSE berbasis Redis (GETDEL single-use)
// bila koneksi Redis tersedia, sehingga autentikasi stream EventSource bekerja konsisten lintas instance.
func InitDistributedSSETicketStore() {
	if database.IsRedisAvailable() {
		security.SetSSETicketStore(&redisSSETicketStore{})
	} else {
		security.SetSSETicketStore(nil)
	}
}

func (s *redisSSETicketStore) Save(ticket string, meta security.SSETicketMeta, ttl time.Duration) error {
	payload, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 800*time.Millisecond)
	defer cancel()
	return database.SetExpiringKey(ctx, "sse:ticket:"+ticket, string(payload), ttl)
}

func (s *redisSSETicketStore) Consume(ticket string) (security.SSETicketMeta, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 800*time.Millisecond)
	defer cancel()
	raw, ok, err := database.GetAndDeleteKey(ctx, "sse:ticket:"+ticket)
	if err != nil || !ok || raw == "" {
		return security.SSETicketMeta{}, false
	}
	var meta security.SSETicketMeta
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return security.SSETicketMeta{}, false
	}
	return meta, true
}

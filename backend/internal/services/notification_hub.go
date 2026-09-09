package services

import (
	"encoding/json"
	"sync"
	"time"

	"catavor-backend/internal/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// SSEClient represents an active Server-Sent Events subscriber connection.
type SSEClient struct {
	ID        string
	UserID    uint
	StoreID   uint
	StorePlan string
	Send      chan []byte
}

// NotificationHub coordinates realtime notification broadcasts to connected clients.
type NotificationHub struct {
	clients map[*SSEClient]bool
	mu      sync.RWMutex
}

var Hub *NotificationHub
var hubOnce sync.Once

// GetNotificationHub returns the singleton NotificationHub instance.
func GetNotificationHub() *NotificationHub {
	hubOnce.Do(func() {
		Hub = &NotificationHub{
			clients: make(map[*SSEClient]bool),
		}
	})
	return Hub
}

// Register adds a new SSEClient to the hub.
func (h *NotificationHub) Register(userID, storeID uint, storePlan string) *SSEClient {
	h.mu.Lock()
	defer h.mu.Unlock()

	client := &SSEClient{
		ID:        uuid.New().String(),
		UserID:    userID,
		StoreID:   storeID,
		StorePlan: storePlan,
		Send:      make(chan []byte, 32),
	}

	h.clients[client] = true
	log.Debug().
		Str("client_id", client.ID).
		Uint("user_id", userID).
		Uint("store_id", storeID).
		Str("plan", storePlan).
		Int("active_clients", len(h.clients)).
		Msg("SSE Notification client connected")

	return client
}

// Unregister removes an SSEClient from the hub.
func (h *NotificationHub) Unregister(client *SSEClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
		log.Debug().
			Str("client_id", client.ID).
			Int("active_clients", len(h.clients)).
			Msg("SSE Notification client disconnected")
	}
}

// Broadcast sends a notification to all matching clients in real-time.
func (h *NotificationHub) Broadcast(notif *models.Notification) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 {
		return
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":        "notification",
		"notification": notif,
		"timestamp":    time.Now().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize notification SSE broadcast")
		return
	}

	sentCount := 0
	for client := range h.clients {
		if h.isClientTargetMatch(client, notif) {
			select {
			case client.Send <- payload:
				sentCount++
			default:
				log.Warn().Str("client_id", client.ID).Msg("SSE client buffer full, skipping frame")
			}
		}
	}

	log.Info().
		Str("notif_id", notif.ID).
		Str("target_type", notif.TargetType).
		Str("target_plan", notif.TargetPlanCode).
		Int("sent_count", sentCount).
		Msg("Realtime notification broadcast delivered")
}

// isClientTargetMatch checks if a connected client satisfies the notification target constraints.
func (h *NotificationHub) isClientTargetMatch(client *SSEClient, notif *models.Notification) bool {
	switch notif.TargetType {
	case "all":
		return true
	case "plan":
		return notif.TargetPlanCode != "" && client.StorePlan == notif.TargetPlanCode
	case "single_store":
		return notif.TargetID > 0 && client.StoreID == notif.TargetID
	case "single_user":
		return notif.TargetID > 0 && client.UserID == notif.TargetID
	default:
		return true
	}
}

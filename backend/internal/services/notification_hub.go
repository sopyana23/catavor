package services

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const redisNotificationPubSubChannel = "catavor:sse:notifications"

// SSEClient represents an active Server-Sent Events subscriber connection.
type SSEClient struct {
	ID           string
	UserID       uint
	StoreID      uint
	StorePlan    string
	PlatformRole string // e.g. "superadmin", "support", "staff", "merchant", "user"
	Send         chan []byte
}

// NotificationHub coordinates realtime notification broadcasts to connected clients.
type NotificationHub struct {
	clients    map[*SSEClient]bool
	mu         sync.RWMutex
	nodeID     string
	bridgeOnce sync.Once
}

var Hub *NotificationHub
var hubOnce sync.Once

// GetNotificationHub returns the singleton NotificationHub instance.
func GetNotificationHub() *NotificationHub {
	hubOnce.Do(func() {
		Hub = &NotificationHub{
			clients: make(map[*SSEClient]bool),
			nodeID:  uuid.NewString(),
		}
	})
	return Hub
}

// PlanMatchesTarget membandingkan paket toko dengan target paket siaran secara case-insensitive
// serta mendukung kompatibilitas target legacy 'pro' untuk 'pro_starter' dan 'pro_business'.
func PlanMatchesTarget(clientPlan, targetPlanCode string) bool {
	target := strings.ToLower(strings.TrimSpace(targetPlanCode))
	if target == "" {
		return false
	}
	client := strings.ToLower(strings.TrimSpace(clientPlan))
	if client == "" {
		client = "free"
	}
	if client == target {
		return true
	}
	if target == "pro" && (client == "pro_starter" || client == "pro_business") {
		return true
	}
	return false
}

// Register adds a new SSEClient to the hub with optional platformRole.
func (h *NotificationHub) Register(userID, storeID uint, storePlan, platformRole string) *SSEClient {
	h.mu.Lock()
	defer h.mu.Unlock()

	normalizedPlan := strings.ToLower(strings.TrimSpace(storePlan))
	if normalizedPlan == "" {
		normalizedPlan = "free"
	}

	client := &SSEClient{
		ID:           uuid.New().String(),
		UserID:       userID,
		StoreID:      storeID,
		StorePlan:    normalizedPlan,
		PlatformRole: strings.ToLower(strings.TrimSpace(platformRole)),
		Send:         make(chan []byte, 64),
	}

	h.clients[client] = true
	log.Debug().
		Str("client_id", client.ID).
		Uint("user_id", userID).
		Uint("store_id", storeID).
		Str("plan", client.StorePlan).
		Str("role", client.PlatformRole).
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

// UpdateStorePlan memperbarui StorePlan seluruh koneksi SSE aktif milik storeID saat paket toko berubah.
func (h *NotificationHub) UpdateStorePlan(storeID uint, newPlan string) int {
	if storeID == 0 {
		return 0
	}
	normalized := strings.ToLower(strings.TrimSpace(newPlan))
	if normalized == "" {
		normalized = "free"
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	updated := 0
	for client := range h.clients {
		if client.StoreID == storeID {
			client.StorePlan = normalized
			updated++
		}
	}
	return updated
}

// GetActiveClientsCount returns the number of currently connected SSE clients.
func (h *NotificationHub) GetActiveClientsCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

type hubPubSubEnvelope struct {
	OriginNode       string               `json:"origin_node"`
	Kind             string               `json:"kind"` // "notification" | "notification_deleted"
	NotificationID   string               `json:"notification_id,omitempty"`
	Notification     *models.Notification `json:"notification,omitempty"`
	TargetRecipients string               `json:"target_recipients,omitempty"`
}

// StartRedisPubSubBridge mendengarkan channel Redis Pub/Sub agar siaran/pencabutan SSE tetap tersampaikan
// ke seluruh instance saat horizontal scaling.
func (h *NotificationHub) StartRedisPubSubBridge(ctx context.Context) {
	if !database.IsRedisAvailable() {
		return
	}
	h.bridgeOnce.Do(func() {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Error().Interface("panic", r).Msg("Recovered from panic in Redis SSE Pub/Sub bridge")
				}
			}()

			msgCh, closeFn, err := database.SubscribeEvents(ctx, redisNotificationPubSubChannel)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to start Redis SSE Pub/Sub bridge; continuing in local hub mode")
				return
			}
			defer closeFn()

			log.Info().Str("channel", redisNotificationPubSubChannel).Msg("SSE NotificationHub Redis Pub/Sub bridge started")
			for raw := range msgCh {
				var env hubPubSubEnvelope
				if err := json.Unmarshal([]byte(raw), &env); err != nil {
					continue
				}
				if env.OriginNode == h.nodeID {
					continue
				}
				if env.Notification != nil && env.TargetRecipients != "" {
					env.Notification.TargetRecipients = env.TargetRecipients
				}
				switch env.Kind {
				case "notification":
					if env.Notification != nil {
						h.dispatchLocalBroadcast(env.Notification)
					}
				case "notification_deleted":
					if env.NotificationID != "" {
						h.dispatchLocalRemoval(env.NotificationID, env.Notification)
					}
				}
			}
		}()
	})
}

// Broadcast sends a general notification to all matching clients in real-time (and publishes to Redis if active).
func (h *NotificationHub) Broadcast(notif *models.Notification) {
	if notif == nil {
		return
	}
	sentCount := h.dispatchLocalBroadcast(notif)

	if database.IsRedisAvailable() {
		env := hubPubSubEnvelope{
			OriginNode:       h.nodeID,
			Kind:             "notification",
			NotificationID:   notif.ID,
			Notification:     notif,
			TargetRecipients: notif.TargetRecipients,
		}
		if b, err := json.Marshal(env); err == nil {
			_ = database.PublishEvent(context.Background(), redisNotificationPubSubChannel, string(b))
		}
	}

	observeCycle("sse_hub", 0, int64(sentCount), nil)
	log.Info().
		Str("notif_id", notif.ID).
		Str("target_type", notif.TargetType).
		Str("target_plan", notif.TargetPlanCode).
		Int("sent_count", sentCount).
		Msg("Realtime notification broadcast delivered")
}

func (h *NotificationHub) dispatchLocalBroadcast(notif *models.Notification) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 || notif == nil {
		return 0
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":        "notification",
		"notification": notif,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize notification SSE broadcast")
		return 0
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
	return sentCount
}

// BroadcastRemoval mengirimkan event real-time notification_deleted saat admin mencabut atau menghapus siaran.
func (h *NotificationHub) BroadcastRemoval(notifID string, notif *models.Notification) {
	if strings.TrimSpace(notifID) == "" {
		return
	}
	sentCount := h.dispatchLocalRemoval(notifID, notif)

	if database.IsRedisAvailable() {
		var recipients string
		if notif != nil {
			recipients = notif.TargetRecipients
		}
		env := hubPubSubEnvelope{
			OriginNode:       h.nodeID,
			Kind:             "notification_deleted",
			NotificationID:   notifID,
			Notification:     notif,
			TargetRecipients: recipients,
		}
		if b, err := json.Marshal(env); err == nil {
			_ = database.PublishEvent(context.Background(), redisNotificationPubSubChannel, string(b))
		}
	}

	log.Info().
		Str("notif_id", notifID).
		Int("sent_count", sentCount).
		Msg("Realtime notification revocation delivered")
}

func (h *NotificationHub) dispatchLocalRemoval(notifID string, notif *models.Notification) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 {
		return 0
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":           "notification_deleted",
		"notification_id": notifID,
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return 0
	}

	sentCount := 0
	for client := range h.clients {
		if notif != nil && !h.isClientTargetMatch(client, notif) {
			continue
		}
		select {
		case client.Send <- payload:
			sentCount++
		default:
			log.Warn().Str("client_id", client.ID).Msg("SSE client buffer full, skipping revocation frame")
		}
	}
	return sentCount
}

// BroadcastTicketEvent sends a real-time ticket event (created, replied, status change)
// to either a specific user and store, or a platform role (e.g. "superadmin", "support").
func (h *NotificationHub) BroadcastTicketEvent(eventType string, ticketData interface{}, targetUserID uint, targetStoreID uint, targetRole string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 {
		return
	}

	targetRoleClean := strings.ToLower(strings.TrimSpace(targetRole))

	payload, err := json.Marshal(map[string]interface{}{
		"event":     eventType,
		"ticket":    ticketData,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize ticket SSE broadcast")
		return
	}

	sentCount := 0
	for client := range h.clients {
		shouldSend := false

		// 1. Target by User ID & Store ID (Store-Scoped Isolation for Merchants)
		if targetUserID > 0 && client.UserID == targetUserID {
			if targetStoreID > 0 {
				// If merchant client is scoped to a store, it MUST match targetStoreID, or client.StoreID == 0 (account level)
				if client.StoreID == 0 || client.StoreID == targetStoreID {
					shouldSend = true
				}
			} else {
				shouldSend = true
			}
		}

		// 2. Target by Role (e.g. "superadmin", "support")
		if targetRoleClean != "" {
			if targetRoleClean == "superadmin" || targetRoleClean == "support" {
				if models.IsPlatformStaffRole(client.PlatformRole) {
					shouldSend = true
				}
			} else if client.PlatformRole == targetRoleClean {
				shouldSend = true
			}
		}

		// 3. Broadcast to all if no target specified
		if targetUserID == 0 && targetRoleClean == "" {
			shouldSend = true
		}

		if shouldSend {
			select {
			case client.Send <- payload:
				sentCount++
			default:
				log.Warn().Str("client_id", client.ID).Msg("SSE client buffer full, skipping ticket event")
			}
		}
	}

	log.Info().
		Str("event", eventType).
		Uint("target_user", targetUserID).
		Uint("target_store", targetStoreID).
		Str("target_role", targetRoleClean).
		Int("sent_count", sentCount).
		Msg("Realtime ticket broadcast delivered")
}

// BroadcastStoreEvent sends a real-time store lifecycle event (such as store_status_updated)
// to connected clients for that store, specific user, or platform administrators.
func (h *NotificationHub) BroadcastStoreEvent(eventType string, storeData interface{}, targetStoreID uint, targetUserID ...uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 {
		return
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":     eventType,
		"store":     storeData,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize store SSE broadcast")
		return
	}

	var uID uint
	if len(targetUserID) > 0 {
		uID = targetUserID[0]
	}

	sentCount := 0
	for client := range h.clients {
		shouldSend := false
		if targetStoreID == 0 {
			shouldSend = true
		} else if client.StoreID == targetStoreID {
			shouldSend = true
		} else if client.PlatformRole == "superadmin" {
			shouldSend = true
		} else if uID > 0 && client.UserID == uID {
			shouldSend = true
		}

		if shouldSend {
			select {
			case client.Send <- payload:
				sentCount++
			default:
				log.Warn().Str("client_id", client.ID).Msg("SSE client buffer full, skipping store event")
			}
		}
	}

	log.Info().
		Str("event", eventType).
		Uint("target_store", targetStoreID).
		Uint("target_user", uID).
		Int("sent_count", sentCount).
		Msg("Realtime store broadcast delivered")
}

// BroadcastQuotaEvent sends a real-time store quota & storage synchronization event
// to connected clients for that store and platform administrators.
func (h *NotificationHub) BroadcastQuotaEvent(targetStoreID uint, quotaData interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.clients) == 0 || targetStoreID == 0 {
		return
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":     "quota_updated",
		"store_id":  targetStoreID,
		"quota":     quotaData,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize quota SSE broadcast")
		return
	}

	sentCount := 0
	for client := range h.clients {
		shouldSend := false
		if client.StoreID == targetStoreID {
			shouldSend = true
		} else if client.PlatformRole == "superadmin" {
			shouldSend = true
		}

		if shouldSend {
			select {
			case client.Send <- payload:
				sentCount++
			default:
				log.Warn().Str("client_id", client.ID).Msg("SSE client buffer full, skipping quota event")
			}
		}
	}

	log.Info().
		Uint("target_store", targetStoreID).
		Int("sent_count", sentCount).
		Msg("Realtime quota broadcast delivered")
}

// isClientTargetMatch checks if a connected client satisfies the notification target constraints.
func (h *NotificationHub) isClientTargetMatch(client *SSEClient, notif *models.Notification) bool {
	if client == nil || notif == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(notif.TargetType)) {
	case "all":
		return true
	case "plan":
		return PlanMatchesTarget(client.StorePlan, notif.TargetPlanCode)
	case "single_store":
		return notif.TargetID > 0 && client.StoreID == notif.TargetID
	case "single_user":
		return notif.TargetID > 0 && client.UserID == notif.TargetID
	case "role", "platform_role", "superadmin":
		return models.IsPlatformStaffRole(client.PlatformRole)
	case "specific":
		if notif.TargetRecipients == "" {
			return false
		}
		type RecipientItem struct {
			Type string `json:"type"`
			ID   uint   `json:"id"`
		}
		var items []RecipientItem
		if err := json.Unmarshal([]byte(notif.TargetRecipients), &items); err == nil && len(items) > 0 {
			for _, item := range items {
				if item.Type == "store" && client.StoreID > 0 && item.ID == client.StoreID {
					return true
				}
				if item.Type == "user" && client.UserID > 0 && item.ID == client.UserID {
					return true
				}
			}
		}
		return false
	default:
		return false
	}
}

// IsClientTargetMatchForTest exposes target match checking for security regression tests.
func (h *NotificationHub) IsClientTargetMatchForTest(client *SSEClient, notif *models.Notification) bool {
	return h.isClientTargetMatch(client, notif)
}

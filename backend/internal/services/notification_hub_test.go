package services

import (
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestNotificationHub_PrivacyAndTargetedStoreQuotaEvents(t *testing.T) {
	hub := GetNotificationHub()

	storeClient := hub.Register(101, 501, "free", "merchant")
	otherStoreClient := hub.Register(102, 502, "free", "merchant")
	complianceClient := hub.Register(1, 0, "free", "compliance")
	defer hub.Unregister(storeClient)
	defer hub.Unregister(otherStoreClient)
	defer hub.Unregister(complianceClient)

	// 1. Specific broadcast SSE frame must redact TargetName sibling tenant summary & internal metadata
	specNotif := &models.Notification{
		ID:                  "notif-sse-spec-1",
		TargetType:          "specific",
		TargetName:          "2 Penerima Terpilih (Toko A, Toko Rahasia B)",
		TargetRecipients:    `[{"type":"store","id":501},{"type":"store","id":502}]`,
		TargetAudienceCount: 2,
		CreatedBy:           1,
		Title:               "Info Spesifik",
		Message:             "Konten",
	}
	hub.Broadcast(specNotif)

	select {
	case raw := <-storeClient.Send:
		s := string(raw)
		if strings.Contains(s, "Toko Rahasia B") || strings.Contains(s, `"target_audience_count":2`) {
			t.Fatalf("SSE frame leaked specific broadcast metadata: %s", s)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("storeClient did not receive specific SSE notification")
	}

	// Drain otherStoreClient from specNotif
	select {
	case <-otherStoreClient.Send:
	case <-time.After(100 * time.Millisecond):
	}

	// 2. BroadcastStoreEvent delivers to target store + compliance staff, not other store
	hub.BroadcastStoreEvent("store_status_updated", map[string]any{"slug": "toko-501", "is_suspended": true}, 501, 101)

	select {
	case raw := <-storeClient.Send:
		if !strings.Contains(string(raw), `"event":"store_status_updated"`) {
			t.Fatalf("unexpected store event frame: %s", string(raw))
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("storeClient did not receive BroadcastStoreEvent")
	}
	select {
	case raw := <-complianceClient.Send:
		if !strings.Contains(string(raw), `"event":"store_status_updated"`) {
			t.Fatalf("compliance staff did not receive BroadcastStoreEvent: %s", string(raw))
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("complianceClient did not receive BroadcastStoreEvent")
	}
	select {
	case leaked := <-otherStoreClient.Send:
		t.Fatalf("otherStoreClient MUST NOT receive BroadcastStoreEvent for store 501: %s", string(leaked))
	case <-time.After(40 * time.Millisecond):
	}

	// 3. BroadcastQuotaEvent delivers only to target store + staff
	hub.BroadcastQuotaEvent(501, map[string]any{"plan": "pro_starter"})
	select {
	case raw := <-storeClient.Send:
		if !strings.Contains(string(raw), `"event":"quota_updated"`) {
			t.Fatalf("unexpected quota event frame: %s", string(raw))
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("storeClient did not receive BroadcastQuotaEvent")
	}
	select {
	case leaked := <-otherStoreClient.Send:
		t.Fatalf("otherStoreClient MUST NOT receive BroadcastQuotaEvent for store 501: %s", string(leaked))
	case <-time.After(40 * time.Millisecond):
	}
}

func TestNotificationCleaner_PreservesComplianceAndPurgesExpiredOrOrphaned(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	_ = db.AutoMigrate(&models.Notification{}, &models.NotificationRead{}, &models.User{}, &models.Store{}, &models.UserSession{})

	now := time.Now().UTC()
	past := now.Add(-1 * time.Hour)
	old35d := now.Add(-35 * 24 * time.Hour)

	fixtures := []models.Notification{
		{ID: "exp-1", TargetType: "all", Title: "Expired", Message: "m", ExpiresAt: &past, CreatedAt: now},
		{ID: "old-guid-1", TargetType: "single_store", TargetID: 1, Category: "PANDUAN", Title: "Old Guide", Message: "m", CreatedAt: old35d},
		{ID: "old-sec-keep", TargetType: "single_store", TargetID: 1, Category: "KEAMANAN", Title: "Security Keep", Message: "m", CreatedAt: old35d},
	}
	for _, n := range fixtures {
		if err := db.Create(&n).Error; err != nil {
			t.Fatalf("seed notif %s: %v", n.ID, err)
		}
	}
	_ = db.Create(&models.NotificationRead{NotificationID: "non-existent-notif", UserID: 1, ReadAt: now}).Error

	if err := runCleanup(db); err != nil {
		t.Fatalf("runCleanup failed: %v", err)
	}

	var countExp, countOldGuide, countSec, countOrphan int64
	db.Model(&models.Notification{}).Where("id = ?", "exp-1").Count(&countExp)
	db.Model(&models.Notification{}).Where("id = ?", "old-guid-1").Count(&countOldGuide)
	db.Model(&models.Notification{}).Where("id = ?", "old-sec-keep").Count(&countSec)
	db.Model(&models.NotificationRead{}).Where("notification_id = ?", "non-existent-notif").Count(&countOrphan)

	if countExp != 0 || countOldGuide != 0 || countSec != 1 || countOrphan != 0 {
		t.Fatalf("unexpected cleanup state: exp=%d oldGuide=%d secKeep=%d orphan=%d", countExp, countOldGuide, countSec, countOrphan)
	}
}

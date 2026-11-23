//go:build automationqa

package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func TestAutomationRuntime(t *testing.T) {
	db := automationTestDB(t)
	database.DB = db
	for _, key := range []string{"SMTP_USER", "MAIL_USERNAME", "SMTP_PASSWORD", "MAIL_PASSWORD", "MAIL_HOST", "MAIL_PORT"} {
		t.Setenv(key, "")
	}
	t.Setenv("SMTP_HOST", "127.0.0.1")
	// An unavailable local SMTP port exercises retry without sending any external mail.
	unused, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("SMTP_PORT", strconv.Itoa(unused.Addr().(*net.TCPAddr).Port))
	unused.Close()
	cfg := &config.Config{JWTSecret: "automation-fixture-only-session-signing-key", StorageDriver: "local", StorageLocalRoot: t.TempDir(), StoragePrivateRoot: t.TempDir()}
	cfg.StorageDir = cfg.StorageLocalRoot
	config.AppConfig = cfg
	driver, err := storage.NewStorageService(cfg)
	if err != nil {
		t.Fatal(err)
	}
	tracker := services.InitAutomationTracker(db, driver)
	services.InitEmailQueue(db)
	handler := NewNotificationHandler(db)
	admin := models.User{Name: "Penguji", Email: "worker@example.invalid", PlatformRole: "superadmin"}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	shop := models.Store{UserID: admin.ID, Slug: "fixture", StoreTitle: "Fixture", PromoBanner: "banner.jpg"}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatal(err)
	}
	product := models.Product{StoreID: shop.ID, Name: "Fixture", Price: 5000}
	if err := db.Create(&product).Error; err != nil {
		t.Fatal(err)
	}
	api := fiber.New()
	api.Post("/trigger", func(c *fiber.Ctx) error { c.Locals("user", &admin); return handler.TriggerAutomationBot(c) })
	trigger := func(t *testing.T, action string) {
		t.Helper()
		req := httptest.NewRequest("POST", "/trigger", strings.NewReader(fmt.Sprintf(`{"action":%q}`, action)))
		req.Header.Set("Content-Type", "application/json")
		res, err := api.Test(req, 10000)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatalf("%s returned HTTP %d", action, res.StatusCode)
		}
	}
	check := func(t *testing.T, query string, args ...interface{}) {
		t.Helper()
		timeout := time.Now().Add(8 * time.Second)
		for {
			var ok bool
			if err := db.Raw(query, args...).Scan(&ok).Error; err != nil {
				t.Fatal(err)
			}
			if ok {
				return
			}
			if time.Now().After(timeout) {
				t.Fatalf("postcondition not met: %s", query)
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
	must := func(t *testing.T, err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC()
	t.Run("onboarding_seed_once", func(t *testing.T) {
		handler.ensureStoreInitialNotifications(shop.ID, admin.ID)
		handler.ensureStoreInitialNotifications(shop.ID, admin.ID)
		check(t, "SELECT count(*)=3 FROM notifications WHERE target_type='single_store' AND target_id=?", shop.ID)
	})
	t.Run("sandbox_notification_and_SSE", func(t *testing.T) {
		hub := services.GetNotificationHub()
		target := hub.Register(admin.ID, 0, "", "superadmin")
		other := hub.Register(admin.ID+1, 0, "", "merchant")
		defer hub.Unregister(target)
		defer hub.Unregister(other)
		trigger(t, "test_guide")
		select {
		case frame := <-target.Send:
			if !bytes.Contains(frame, []byte("test_guide_")) {
				t.Fatal("unexpected notification")
			}
		case <-time.After(time.Second):
			t.Fatal("no frame")
		}
		select {
		case <-other.Send:
			t.Fatal("unexpected delivery")
		default:
		}
		check(t, "SELECT count(*)=1 FROM notifications WHERE target_type='single_user' AND target_id=? AND id LIKE 'test_guide_%'", admin.ID)
	})
	for _, id := range []string{"promo_expiry", "flash_sale", "weekly_summary"} {
		t.Run(id, func(t *testing.T) {
			trigger(t, id)
			summary := map[string]string{"promo_expiry": "1 toko memiliki banner promo.", "flash_sale": "1 produk aktif.", "weekly_summary": "1 toko, 1 pengguna, 1 produk aktif, 0 tiket terbuka."}[id]
			check(t, "SELECT count(*)=1 FROM automation_logs WHERE bot_name=? AND status='success' AND details=? AND triggered_by=? ", id, summary, fmt.Sprintf("user:%d", admin.ID))
		})
	}
	for _, id := range []string{"store_expiry", "dormancy_worker"} {
		t.Run(id, func(t *testing.T) {
			stale := models.Store{Slug: id, StoreTitle: id, UserID: admin.ID, LastActivityAt: now.AddDate(0, 0, -31)}
			must(t, db.Create(&stale).Error)
			trigger(t, id)
			check(t, "SELECT dormancy_status='warning_1' FROM stores WHERE id=?", stale.ID)
			check(t, "SELECT dormancy_status='active' FROM stores WHERE id=?", shop.ID)
			check(t, "SELECT count(*) >= ? FROM automation_logs WHERE bot_name='store_expiry' AND action='executed_cycle'", map[string]int{"store_expiry": 1, "dormancy_worker": 2}[id])
		})
	}
	t.Run("support_lifecycle", func(t *testing.T) {
		ticket := models.SupportTicket{TicketNumber: "QA-SLA", UserID: admin.ID, StoreID: &shop.ID, Category: "technical", Status: "waiting_user", Subject: "Fixture", LastMessageAt: now.Add(-73 * time.Hour)}
		must(t, db.Create(&ticket).Error)
		trigger(t, "support_lifecycle")
		check(t, "SELECT reminder_count=1 FROM support_tickets WHERE id=?", ticket.ID)
		check(t, "SELECT count(*)=1 FROM support_messages WHERE ticket_id=?", ticket.ID)
		must(t, db.Model(&ticket).Update("reminder_sent_at", now.Add(-49*time.Hour)).Error)
		done := make(chan error, 2)
		for _, origin := range []string{"manual_admin", "cron"} {
			go func(origin string) {
				_, err := services.RunSupportLifecycle(db, driver, origin, "qa")
				done <- err
			}(origin)
		}
		must(t, <-done)
		must(t, <-done)
		check(t, "SELECT status='resolved' FROM support_tickets WHERE id=?", ticket.ID)
		check(t, "SELECT count(*)=2 FROM support_messages WHERE ticket_id=?", ticket.ID)
		must(t, db.Model(&ticket).Update("resolved_at", now.AddDate(0, 0, -8)).Error)
		trigger(t, "support_lifecycle")
		check(t, "SELECT status='closed' FROM support_tickets WHERE id=?", ticket.ID)
	})
	t.Run("ticket_retention_worker", func(t *testing.T) {
		closed := now.AddDate(0, 0, -31)
		for _, category := range []string{"billing", "technical"} {
			must(t, db.Create(&models.SupportTicket{TicketNumber: "QA-" + category, Status: "closed", Category: category, Subject: "Fixture", ClosedAt: &closed, UserID: admin.ID}).Error)
		}
		trigger(t, "ticket_retention_worker")
		check(t, "SELECT count(*)=0 FROM support_tickets WHERE ticket_number='QA-billing'")
		check(t, "SELECT count(*)=1 FROM support_tickets WHERE ticket_number='QA-technical'")
	})
	t.Run("item_retention_worker", func(t *testing.T) {
		item := models.Product{StoreID: shop.ID, Name: "Expired item"}
		must(t, db.Create(&item).Error)
		must(t, db.Model(&item).Update("deleted_at", now.Add(-73*time.Hour)).Error)
		trigger(t, "item_retention_worker")
		check(t, "SELECT count(*)=0 FROM products WHERE id=?", item.ID)
		check(t, "SELECT count(*)=1 FROM products WHERE id=?", product.ID)
	})
	t.Run("cleaner_worker", func(t *testing.T) {
		past := now.Add(-time.Hour)
		must(t, db.Create(&models.Notification{ID: "qa-expired", ExpiresAt: &past, Title: "Fixture"}).Error)
		trigger(t, "cleaner_worker")
		check(t, "SELECT count(*)=0 FROM notifications WHERE id='qa-expired'")
		check(t, "SELECT count(*)=1 FROM notifications WHERE id LIKE 'test_guide_%'")
	})
	t.Run("storage_sweeper", func(t *testing.T) {
		folder := filepath.Join(cfg.StorageLocalRoot, "stores", fmt.Sprint(shop.ID), "products")
		must(t, os.MkdirAll(folder, 0700))
		file := filepath.Join(folder, "orphan.jpg")
		must(t, os.WriteFile(file, []byte("orphan"), 0600))
		old := now.Add(-3 * time.Hour)
		must(t, os.Chtimes(file, old, old))
		draft := filepath.Join(folder, "draft.jpg")
		must(t, os.WriteFile(draft, []byte("draft"), 0600))
		trigger(t, "storage_sweeper")
		if _, err := os.Stat(file); !os.IsNotExist(err) {
			t.Errorf("old orphan still present: %v", err)
		}
		_, err := os.Stat(draft)
		must(t, err)
	})
	t.Run("search_ingest_click_market_rollup", func(t *testing.T) {
		search := services.InitSearchTelemetryService(db)
		defer search.Stop()
		if !search.EnqueueSearchEvent(models.SearchAnalytics{Keyword: "tanaman hias", ProductType: "plant"}) {
			t.Fatal("event rejected")
		}
		check(t, "SELECT count(*)=1 FROM search_analytics WHERE clean_keyword='tanaman hias'")
		search.RecordSearchClick("tanaman hias", "plant")
		check(t, "SELECT count(*)=1 FROM search_daily_rollups WHERE keyword='tanaman hias' AND clicked_product_count=1")
		yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")
		must(t, db.Create(&models.SearchAnalytics{Keyword: "bibit", CleanKeyword: "bibit", Date: yesterday, ProductType: "plant"}).Error)
		trigger(t, "market_intel_worker")
		check(t, "SELECT count(*)=1 FROM search_daily_rollups WHERE date=? AND keyword='bibit' AND search_volume=1", yesterday)
		check(t, "SELECT count(*)>0 FROM market_daily_rollups WHERE date=?", yesterday)
	})
	t.Run("store_ingest_flush_and_trending", func(t *testing.T) {
		telemetry := services.InitStoreTelemetryService(db)
		defer telemetry.Stop()
		expired := models.RecentVisitorEvent{StoreID: shop.ID, City: "Bogor", DeviceType: "mobile", CreatedAt: now.AddDate(0, 0, -8)}
		must(t, db.Create(&expired).Error)
		must(t, telemetry.PruneRecentVisitors(now))
		must(t, telemetry.PruneRecentVisitors(now))
		check(t, "SELECT count(*)=0 FROM recent_visitor_events WHERE id=?", expired.ID)
		check(t, "SELECT count(*)=1 FROM store_daily_audience_metrics WHERE dimension_type='co_visit' AND dimension_value='mobile|Bogor' AND views=1")
		if !telemetry.EnqueueEvent(services.StoreTelemetryEvent{StoreID: shop.ID, Event: "store_view", StoreSlug: shop.Slug, SessionID: "fixture", Timestamp: now}) {
			t.Fatal("event rejected")
		}
		check(t, "SELECT count(*)=1 FROM store_daily_analytics WHERE store_id=? AND store_views=1", shop.ID)
		must(t, services.CalculateRolling7DayTrendingScores(db))
		check(t, "SELECT trending_score_7d=1 FROM stores WHERE id=?", shop.ID)
	})
	t.Run("ad_batch", func(t *testing.T) {
		slot := models.AdSlot{SlotCode: "fixture", Name: "QA"}
		must(t, db.Create(&slot).Error)
		campaign := models.AdCampaign{CampaignCode: "fixture", StoreID: shop.ID, AdSlotID: slot.ID, TargetID: uint64(shop.ID), TargetStoreID: &shop.ID, CampaignName: "QA", StartAt: now, EndAt: now.Add(time.Hour)}
		must(t, db.Create(&campaign).Error)
		ads := services.GetAdTelemetryService()
		ads.RecordImpression(campaign.ID, slot.ID, shop.ID)
		rolledBack := db.Begin()
		must(t, rolledBack.Error)
		must(t, rolledBack.Rollback().Error)
		if err := ads.FlushToDatabase(rolledBack); err == nil {
			t.Fatal("expected flush error on a closed transaction")
		}
		must(t, ads.FlushToDatabase(db))
		must(t, ads.FlushToDatabase(db))
		check(t, "SELECT count(*)=1 FROM ad_daily_metrics WHERE campaign_id=? AND impressions_count=1", campaign.ID)
	})
	t.Run("subscription", func(t *testing.T) {
		exp := now.Add(-time.Hour)
		paid := models.Store{Slug: "paid", StoreTitle: "Paid", UserID: admin.ID, Plan: "pro", PlanExpiresAt: &exp}
		must(t, db.Create(&paid).Error)
		must(t, services.ProcessSubscriptionLifecycle(db))
		check(t, "SELECT plan_status='grace_period' AND grace_period_until IS NOT NULL FROM stores WHERE id=?", paid.ID)
	})
	t.Run("moderation_escalation", func(t *testing.T) {
		old := now.AddDate(0, 0, -32)
		banned := models.Store{Slug: "mod", StoreTitle: "Mod", UserID: admin.ID, DormancyStatus: "suspended", SuspensionReason: "moderation_violation", DormancySuspendedAt: &old}
		must(t, db.Create(&banned).Error)
		services.RunModerationEscalationCycle(db, driver)
		check(t, "SELECT dormancy_status='banned' FROM stores WHERE id=?", banned.ID)
	})
	t.Run("activity_log_retention", func(t *testing.T) {
		entry := models.ActivityLog{StoreID: &shop.ID, Action: "qa", CreatedAt: now.AddDate(0, 0, -91)}
		must(t, db.Create(&entry).Error)
		_, err := services.CleanOldActivityLogs(db)
		must(t, err)
		check(t, "SELECT count(*)=0 FROM activity_logs WHERE id=?", entry.ID)
	})
	t.Run("email_retry", func(t *testing.T) {
		job, err := services.EnqueueEmail(admin.Email, "QA", "QA", "Queue test", "Fixture", "qa", "fixture")
		must(t, err)
		if job == nil {
			t.Fatal("not queued")
		}
		check(t, "SELECT attempts=1 AND next_retry_at>now() AND status='pending' FROM email_jobs WHERE id=?", job.ID)
	})
	t.Run("email_delivered_to_local_sink", func(t *testing.T) {
		sink, err := net.Listen("tcp4", "127.0.0.1:0")
		must(t, err)
		defer sink.Close()
		t.Setenv("SMTP_PORT", strconv.Itoa(sink.Addr().(*net.TCPAddr).Port))
		t.Setenv("SMTP_FROM", "test@example.invalid")
		reached := make(chan string, 1)
		go func() {
			for {
				conn, err := sink.Accept()
				if err != nil {
					return
				}
				go func(conn net.Conn) {
					defer conn.Close()
					conn.SetDeadline(time.Now().Add(5 * time.Second))
					fmt.Fprint(conn, "220 localhost SMTP\r\n")
					reader := textproto.NewReader(bufio.NewReader(conn))
					for {
						line, err := reader.ReadLine()
						if err != nil {
							return
						}
						switch {
						case line == "DATA":
							fmt.Fprint(conn, "354 Enter message\r\n")
							body, err := reader.ReadDotBytes()
							if err != nil {
								return
							}
							if bytes.Contains(body, []byte("Subject: Local delivery fixture")) {
								select {
								case reached <- string(body):
								default:
								}
							}
						case line == "QUIT":
							fmt.Fprint(conn, "221 Bye\r\n")
							return
						}
						fmt.Fprint(conn, "250 OK\r\n")
					}
				}(conn)
			}
		}()
		job, err := services.EnqueueEmail(admin.Email, "QA", "QA", "Local delivery fixture", "Body fixture", "qa", "mail-sink")
		must(t, err)
		select {
		case body := <-reached:
			if !strings.Contains(body, admin.Email) {
				t.Fatal("wrong destination")
			}
		case <-time.After(8 * time.Second):
			t.Fatal("message missing in sink")
		}
		check(t, "SELECT status='sent' AND sent_at IS NOT NULL FROM email_jobs WHERE id=?", job.ID)
	})
	t.Run("banned_media_retention", func(t *testing.T) {
		stamp := now.AddDate(0, 0, -91)
		store := models.Store{Slug: "media-tombstone", UserID: admin.ID, DormancyStatus: "banned", DormancyBannedAt: &stamp}
		must(t, db.Create(&store).Error)
		key := fmt.Sprintf("stores/%d/logo.jpg", store.ID)
		f := filepath.Join(cfg.StorageLocalRoot, filepath.FromSlash(key))
		must(t, os.MkdirAll(filepath.Dir(f), 0700))
		must(t, os.WriteFile(f, []byte("media"), 0600))
		must(t, db.Model(&store).Update("store_logo_url", "/storage/"+key).Error)
		services.RunModerationEscalationCycle(db, driver)
		check(t, "SELECT dormancy_status='banned' AND store_logo_url='' FROM stores WHERE id=?", store.ID)
		if _, err := os.Stat(f); !os.IsNotExist(err) {
			t.Fatal("media not removed")
		}
	})
	t.Run("role_matrix_and_preview", func(t *testing.T) {
		role := models.PlatformRole{}
		must(t, db.Where("slug=?", "support").First(&role).Error)
		var view models.PlatformPermission
		must(t, db.Where("key=?", "system:automation:view").First(&view).Error)
		must(t, db.Model(&role).Association("Permissions").Replace(&view))
		services.GetRBACService().RefreshCache()
		app := fiber.New()
		var operator *models.User
		app.Use(func(c *fiber.Ctx) error {
			if operator != nil {
				c.Locals("user", operator)
			}
			return c.Next()
		})
		handler.RegisterAutomationRoutes(app, cfg)
		request := func(method, path string, status int) map[string]interface{} {
			t.Helper()
			res, err := app.Test(httptest.NewRequest(method, "/automation/"+path, nil), 5000)
			must(t, err)
			defer res.Body.Close()
			if res.StatusCode != status {
				t.Fatalf("%s %s = %d want %d", method, path, res.StatusCode, status)
			}
			var result map[string]interface{}
			must(t, json.NewDecoder(res.Body).Decode(&result))
			return result
		}
		request("GET", "status", 401)
		operator = &models.User{PlatformRole: "merchant"}
		request("GET", "logs", 403)
		operator = &models.User{PlatformRole: "support"}
		snapshot := request("GET", "status", 200)["data"].(map[string]interface{})
		workers := snapshot["workers"].([]interface{})
		if len(workers) != 25 {
			t.Fatalf("catalog has %d entries", len(workers))
		}
		manual := 0
		for _, row := range workers {
			job := row.(map[string]interface{})
			if job["conditions"] == "" || job["interval_desc"] == "" {
				t.Fatalf("missing operating conditions: %v", job["name"])
			}
			if job["manual"] == true {
				manual++
			}
		}
		if manual != 11 {
			t.Fatalf("catalog has %d manual controls", manual)
		}
		request("GET", "logs", 200)
		request("POST", "trigger", 403)
		before := int64(0)
		must(t, db.Model(&models.SupportTicket{}).Count(&before).Error)
		for _, c := range []struct{ age, n int }{{0, 0}, {29, 0}, {30, 1}, {59, 1}, {60, 2}} {
			result := request("GET", fmt.Sprintf("preview?age_days=%d", c.age), 200)
			if result["eligible"] != float64(c.n) {
				t.Fatalf("preview at %d: %v", c.age, result)
			}
		}
		request("GET", "preview?age_days=-1", 400)
		check(t, "SELECT count(*)=? FROM support_tickets WHERE deleted_at IS NULL", before)
		operator = &admin
		request("POST", "trigger?action=promo_expiry", 200)
	})
	t.Run("store_dormancy_and_owner_erasure", func(t *testing.T) {
		owner := models.User{Name: "Pemilik QA", Email: "two-shops@example.invalid", HasCustomPassword: true, EmailVerifiedAt: &now}
		must(t, owner.SetPassword("local-fixture-pass"))
		must(t, db.Create(&owner).Error)
		createStore := func(slug string) models.Store {
			row := models.Store{Slug: slug, StoreTitle: slug, UserID: owner.ID, LastActivityAt: now}
			must(t, db.Create(&row).Error)
			return row
		}
		stale, live := createStore("qa-dormant"), createStore("qa-live")
		must(t, db.Model(&models.Store{}).Where("user_id = ?", owner.ID).Update("last_activity_at", now.AddDate(0, 0, -10)).Error)
		loginApp := fiber.New()
		loginApp.Post("/login", NewAuthHandler(cfg, db, driver).Login)
		loginReq := httptest.NewRequest("POST", "/login", strings.NewReader(`{"email":"two-shops@example.invalid","password":"local-fixture-pass","store_slug":"qa-live"}`))
		loginReq.Header.Set("Content-Type", "application/json")
		loginRes, err := loginApp.Test(loginReq, 10000)
		must(t, err)
		loginRes.Body.Close()
		if loginRes.StatusCode != 200 {
			t.Fatalf("selected store login returned %d", loginRes.StatusCode)
		}
		check(t, "SELECT last_activity_at >= ? FROM stores WHERE id=?", now, live.ID)
		check(t, "SELECT last_activity_at < ? FROM stores WHERE id=?", now.AddDate(0, 0, -9), stale.ID)
		makeDormant := func(id uint) {
			must(t, db.Model(&models.Store{}).Where("id = ?", id).Updates(map[string]interface{}{
				"dormancy_status": "suspended", "suspension_reason": "dormancy", "is_suspended": true, "last_activity_at": now.AddDate(0, 0, -61),
			}).Error)
		}
		newTicket := func(number string, storeID *uint) models.SupportTicket {
			ticket := models.SupportTicket{TicketNumber: number, Subject: number, UserID: owner.ID, StoreID: storeID, Status: "open", Category: "technical"}
			must(t, db.Create(&ticket).Error)
			return ticket
		}
		targetTicket := newTicket("QA-OLD-SHOP", &stale.ID)
		msg := models.SupportMessage{TicketID: targetTicket.ID, SenderID: owner.ID, SenderType: "user", Message: "Bukti"}
		must(t, db.Create(&msg).Error)
		key := "private/support/tickets/qa-owner-closure.jpg"
		_, err = driver.Upload(context.Background(), key, strings.NewReader("proof"), 5, "image/jpeg")
		must(t, err)
		must(t, db.Create(&models.SupportAttachment{MessageID: msg.ID, StorageKey: key, FileName: "bukti.jpg", FileSize: 5}).Error)
		liveTicket := newTicket("QA-LIVE-SHOP", &live.ID)
		newTicket("QA-ACCOUNT", nil)
		for _, s := range []models.Store{stale, live} {
			must(t, db.Create(&models.Product{StoreID: s.ID, Name: s.Slug}).Error)
			file := filepath.Join(cfg.StorageLocalRoot, "stores", strconv.Itoa(int(s.ID)), "asset.jpg")
			must(t, os.MkdirAll(filepath.Dir(file), 0700))
			must(t, os.WriteFile(file, []byte("fixture"), 0600))
			must(t, db.Create(&models.Notification{ID: "notice-" + s.Slug, TargetType: "single_store", TargetID: s.ID, Title: "Notice"}).Error)
		}
		must(t, db.Create(&models.Notification{ID: "notice-owner", TargetType: "single_user", TargetID: owner.ID, Title: "Account"}).Error)
		invoice := models.SubscriptionOrder{OrderNumber: "QA-SCOPED-INVOICE", UserID: owner.ID, StoreID: stale.ID, PlanCode: "pro", Type: "renewal", PaymentStatus: "paid", FinalAmount: 12345}
		must(t, db.Create(&invoice).Error)
		agreement := models.UserPolicyAgreement{UserID: &owner.ID, StoreID: &stale.ID, PolicyType: "privacy", PolicyVersion: "qa"}
		must(t, db.Create(&agreement).Error)
		makeDormant(stale.ID)
		for i := 0; i < 2; i++ {
			services.RunDormancyCycle(db, driver)
		}
		check(t, "SELECT count(*)=0 FROM stores WHERE id=?", stale.ID)
		check(t, "SELECT count(*)=0 FROM products WHERE store_id=?", stale.ID)
		check(t, "SELECT count(*)=1 FROM products WHERE store_id=?", live.ID)
		check(t, "SELECT count(*)=1 FROM users WHERE id=?", owner.ID)
		check(t, "SELECT count(*)=1 FROM support_tickets WHERE id=? AND store_id IS NULL AND status='open'", targetTicket.ID)
		check(t, "SELECT count(*)=1 FROM support_tickets WHERE id=? AND store_id=? AND status='open'", liveTicket.ID, live.ID)
		check(t, "SELECT count(*)=2 FROM notifications WHERE id IN ('notice-owner','notice-qa-live')")
		check(t, "SELECT count(*)=1 FROM retained_store_orders WHERE former_store_id=? AND snapshot->>'order_number'=? AND (snapshot->>'final_amount')::numeric=12345", stale.ID, invoice.OrderNumber)
		for _, s := range []models.Store{stale, live} {
			_, err := os.Stat(filepath.Join(cfg.StorageLocalRoot, "stores", strconv.Itoa(int(s.ID)), "asset.jpg"))
			if (s.ID == stale.ID && !os.IsNotExist(err)) || (s.ID == live.ID && err != nil) {
				t.Fatalf("unexpected media state for store %d: %v", s.ID, err)
			}
		}
		makeDormant(live.ID)
		services.RunDormancyCycle(db, driver)
		check(t, "SELECT count(*)=0 FROM stores WHERE user_id=?", owner.ID)
		check(t, "SELECT count(*)=1 FROM users WHERE id=?", owner.ID)
		noStoreReq := httptest.NewRequest("POST", "/login", strings.NewReader(`{"email":"two-shops@example.invalid","password":"local-fixture-pass"}`))
		noStoreReq.Header.Set("Content-Type", "application/json")
		noStoreRes, err := loginApp.Test(noStoreReq, 10000)
		must(t, err)
		noStoreRes.Body.Close()
		if noStoreRes.StatusCode != 200 {
			t.Fatalf("owner login after last store purge returned %d", noStoreRes.StatusCode)
		}
		first, second := createStore("qa-close-first"), createStore("qa-close-second")
		slot := models.AdSlot{SlotCode: "qa-close-slot", Name: "Arsip"}
		must(t, db.Create(&slot).Error)
		ad := models.AdCampaign{StoreID: second.ID, AdSlotID: slot.ID, CampaignCode: "qa-close-campaign", CampaignName: "Promosi toko", TargetID: uint64(second.ID), TargetStoreID: &second.ID, StartAt: now, EndAt: now.Add(time.Hour)}
		must(t, db.Create(&ad).Error)
		paidAd := models.AdOrder{StoreID: second.ID, CampaignID: ad.ID, UserID: owner.ID, OrderNumber: "QA-AD-CLOSED", SlotNameSnapshot: "Arsip", PricingModelSnapshot: "flat_daily", PaymentStatus: "paid", FinalAmount: 7000}
		must(t, db.Create(&paidAd).Error)
		manual := createStore("qa-delete-manually")
		storeApp := fiber.New()
		storeApp.Delete("/stores/:id", func(c *fiber.Ctx) error {
			c.Locals("user", &owner)
			return NewStoreHandler(db, cfg, driver).DeleteStore(c)
		})
		storeReq := httptest.NewRequest("DELETE", fmt.Sprintf("/stores/%d", manual.ID), strings.NewReader(`{"confirm_slug":"qa-delete-manually","password":"local-fixture-pass"}`))
		storeReq.Header.Set("Content-Type", "application/json")
		deleted, err := storeApp.Test(storeReq, 10000)
		must(t, err)
		deleted.Body.Close()
		if deleted.StatusCode != 200 {
			t.Fatalf("manual store deletion returned %d", deleted.StatusCode)
		}
		check(t, "SELECT count(*)=2 FROM stores WHERE user_id=?", owner.ID)
		rollbackErr := fmt.Errorf("synthetic rollback")
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := services.DeleteStoreRecords(tx, first.ID); err != nil {
				return err
			}
			return rollbackErr
		}); err != rollbackErr {
			t.Fatalf("expected rollback: %v", err)
		}
		check(t, "SELECT count(*)=1 FROM stores WHERE id=?", first.ID)
		check(t, "SELECT count(*)=0 FROM pending_store_media_deletions WHERE store_id=?", first.ID)
		retryStore := createStore("qa-retry-cleanup")
		retryFile := filepath.Join(cfg.StorageLocalRoot, "stores", strconv.Itoa(int(retryStore.ID)), "pending.jpg")
		must(t, os.MkdirAll(filepath.Dir(retryFile), 0700))
		must(t, os.WriteFile(retryFile, []byte("pending"), 0600))
		must(t, db.Transaction(func(tx *gorm.DB) error { return services.DeleteStoreRecords(tx, retryStore.ID) }))
		check(t, "SELECT count(*)=1 FROM pending_store_media_deletions WHERE store_id=?", retryStore.ID)
		services.RunStorageSweep(db)
		check(t, "SELECT count(*)=0 FROM pending_store_media_deletions WHERE store_id=?", retryStore.ID)
		if _, err := os.Stat(retryFile); !os.IsNotExist(err) {
			t.Fatal("sweeper left pending media")
		}
		proofFile := filepath.Join(cfg.StoragePrivateRoot, "support", "tickets", "qa-owner-closure.jpg")
		_, err = os.Stat(proofFile)
		must(t, err)
		accountApp := fiber.New()
		accountApp.Post("/close", func(c *fiber.Ctx) error {
			c.Locals("user", &owner)
			return NewAuthHandler(cfg, db, driver).DeleteAccount(c)
		})
		closeRequest := func(phrase string) int {
			req := httptest.NewRequest("POST", "/close", strings.NewReader(fmt.Sprintf(`{"confirm_phrase":%q,"password":"local-fixture-pass"}`, phrase)))
			req.Header.Set("Content-Type", "application/json")
			response, err := accountApp.Test(req, 10000)
			must(t, err)
			defer response.Body.Close()
			return response.StatusCode
		}
		if closeRequest("belum") != 400 {
			t.Fatal("invalid confirmation accepted")
		}
		check(t, "SELECT count(*)=2 FROM stores WHERE user_id=?", owner.ID)
		if status := closeRequest("HAPUS AKUN SAYA"); status != 200 {
			t.Fatalf("account closure returned %d", status)
		}
		check(t, "SELECT count(*)=0 FROM stores WHERE id IN (?,?)", first.ID, second.ID)
		check(t, "SELECT count(*)=0 FROM users WHERE id=?", owner.ID)
		check(t, "SELECT count(*)=1 FROM retained_store_orders WHERE order_kind='advertising' AND former_store_id=? AND snapshot->>'order_number'=? AND (snapshot->>'final_amount')::numeric=7000", second.ID, paidAd.OrderNumber)
		check(t, "SELECT count(*)=0 FROM pending_owner_media_deletions WHERE owner_id=?", owner.ID)
		check(t, "SELECT count(*)=0 FROM user_sessions WHERE user_id=?", owner.ID)
		check(t, "SELECT count(*)=0 FROM support_tickets WHERE user_id=?", owner.ID)
		if _, err := os.Stat(proofFile); !os.IsNotExist(err) {
			t.Fatal("closure left private attachment")
		}
		check(t, "SELECT count(*)=0 FROM notifications WHERE id='notice-owner'")
		check(t, "SELECT count(*)=1 FROM user_policy_agreements WHERE id=? AND user_id IS NULL AND store_id IS NULL", agreement.ID)
		check(t, "SELECT count(*)=1 FROM stores WHERE id=? AND user_id=?", shop.ID, admin.ID)
	})
	if tracker == nil {
		t.Fatal("tracker unavailable")
	}
}

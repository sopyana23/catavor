package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

func newOnboardingNotifTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := newHardeningDB(t)
	if err := db.AutoMigrate(&models.Notification{}, &models.EmailJob{}); err != nil {
		t.Fatalf("migrasi notification/email_job gagal: %v", err)
	}
	return db
}

func TestOnboardingNotifications_PlanSpecificAndIdempotent(t *testing.T) {
	db := newOnboardingNotifTestDB(t)

	cases := []struct {
		name         string
		planCode     string
		pending      *models.SubscriptionOrder
		wantTitleSub string
		wantCat      string
		wantSubTab   string
	}{
		{
			name:         "free",
			planCode:     "free",
			wantTitleSub: "Gratis Terbatas",
			wantCat:      "PANDUAN",
			wantSubTab:   "subscription",
		},
		{
			name:         "pro_starter",
			planCode:     "pro_starter",
			wantTitleSub: "Pro Starter",
			wantCat:      "LANGGANAN",
			wantSubTab:   "subscription",
		},
		{
			name:         "pro_business",
			planCode:     "pro_business",
			wantTitleSub: "Pro Bisnis",
			wantCat:      "LANGGANAN",
			wantSubTab:   "settings",
		},
		{
			name:     "paid_pending",
			planCode: "free",
			pending: &models.SubscriptionOrder{
				ID:            77,
				OrderNumber:   "INV-TEST-PENDING-77",
				PlanCode:      "pro_starter",
				FinalAmount:   30123,
				PaymentStatus: "pending_verification",
			},
			wantTitleSub: "Dalam Verifikasi",
			wantCat:      "TAGIHAN",
			wantSubTab:   "subscription",
		},
	}

	for idx, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			u := models.User{Name: "Owner " + tc.name, Email: fmt.Sprintf("%s@test.local", tc.name)}
			u.SetPassword("StrongPass!123")
			if err := db.Create(&u).Error; err != nil {
				t.Fatalf("create user: %v", err)
			}
			st := models.Store{
				UserID: u.ID,
				Slug:   fmt.Sprintf("store-%s-%d", tc.name, idx),
				StoreTitle: "Toko " + tc.name,
				Plan:   tc.planCode,
			}
			if err := db.Create(&st).Error; err != nil {
				t.Fatalf("create store: %v", err)
			}

			DispatchRegistrationOnboarding(db, &u, &st, tc.pending)
			// Calling twice must be idempotent without duplicating DB rows
			EnsureStoreOnboardingNotifications(db, &st, tc.pending)

			var notifs []models.Notification
			if err := db.Where("target_type = 'single_store' AND target_id = ?", st.ID).Find(&notifs).Error; err != nil {
				t.Fatalf("query notifications: %v", err)
			}
			if len(notifs) != 4 {
				t.Fatalf("expected 4 onboarding notifications, got %d", len(notifs))
			}

			var welcome *models.Notification
			for i := range notifs {
				if notifs[i].ID == fmt.Sprintf("notif_welcome_%d", st.ID) {
					welcome = &notifs[i]
					break
				}
			}
			if welcome == nil {
				t.Fatalf("welcome notification missing")
			}
			if !strings.Contains(welcome.Title, tc.wantTitleSub) {
				t.Errorf("welcome title = %q, want substring %q", welcome.Title, tc.wantTitleSub)
			}
			if welcome.Category != tc.wantCat {
				t.Errorf("welcome category = %q, want %q", welcome.Category, tc.wantCat)
			}
			if welcome.LinkSubTab != tc.wantSubTab {
				t.Errorf("welcome link_sub_tab = %q, want %q", welcome.LinkSubTab, tc.wantSubTab)
			}

			var emailCount int64
			db.Model(&models.EmailJob{}).Where("recipient_email = ? AND category = 'welcome_onboarding'", u.Email).Count(&emailCount)
			if emailCount != 1 {
				t.Errorf("expected 1 welcome_onboarding email job, got %d", emailCount)
			}
		})
	}
}

func TestSubscriptionLifecycleNotificationsAndQuotaPendingOrder(t *testing.T) {
	db := newOnboardingNotifTestDB(t)
	db.Create(&models.Setting{Key: "payment_system_mode", Value: "manual_qris"})

	u := models.User{Name: "Budi Merchant", Email: "budi.merchant@test.local"}
	u.SetPassword("StrongPass!123")
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	st := models.Store{UserID: u.ID, Slug: "toko-budi", StoreTitle: "Toko Budi", Plan: "free", PlanStatus: "active"}
	if err := db.Create(&st).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	// 1. Create pending manual verification order -> pending_order surfaced on quota + notif + email
	order, quota, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		PaymentMethod:     "qris",
		SenderAccountName: "Budi Santoso",
		PaymentProofURL:   "private/billing/users/" + fmt.Sprintf("%d", u.ID) + "/proof.png",
	})
	if err != nil {
		t.Fatalf("CreateSubscriptionOrder failed: %v", err)
	}
	if quota == nil || quota.PendingOrder == nil || quota.PendingOrder.OrderNumber != order.OrderNumber {
		t.Fatalf("expected StoreQuotaInfo.PendingOrder to expose %s, got %+v", order.OrderNumber, quota)
	}

	var pendingNotif models.Notification
	if err := db.Where("id = ?", fmt.Sprintf("notif_sub_pending_%d", order.ID)).First(&pendingNotif).Error; err != nil {
		t.Fatalf("expected pending notification: %v", err)
	}
	var pendingMail int64
	db.Model(&models.EmailJob{}).Where("recipient_email = ? AND category = 'subscription_order_pending'", u.Email).Count(&pendingMail)
	if pendingMail != 1 {
		t.Fatalf("expected 1 subscription_order_pending email, got %d", pendingMail)
	}

	// 2. Approve order -> plan upgrades, pending_order clears, activated notif + email created
	_, afterApproveQuota, err := ApproveSubscriptionOrder(db, order.ID, 99)
	if err != nil {
		t.Fatalf("ApproveSubscriptionOrder failed: %v", err)
	}
	if afterApproveQuota.PendingOrder != nil {
		t.Fatalf("expected PendingOrder to clear after approval, got %+v", afterApproveQuota.PendingOrder)
	}
	var activeNotif models.Notification
	if err := db.Where("id = ?", fmt.Sprintf("notif_sub_active_%d", order.ID)).First(&activeNotif).Error; err != nil {
		t.Fatalf("expected activation notification: %v", err)
	}
	var activeMail int64
	db.Model(&models.EmailJob{}).Where("recipient_email = ? AND category = 'subscription_activated'", u.Email).Count(&activeMail)
	if activeMail != 1 {
		t.Fatalf("expected 1 subscription_activated email, got %d", activeMail)
	}

	// 3. Expired pending order -> creates expired notif + email & clears pending order
	expTime := time.Now().UTC().Add(-10 * time.Minute)
	expOrder := models.SubscriptionOrder{
		StoreID:       st.ID,
		UserID:        u.ID,
		OrderNumber:   "INV-SUB-EXP-901",
		Type:          "upgrade",
		PlanCode:      "pro_business",
		BillingCycle:  "monthly",
		FinalAmount:   129000,
		PaymentMethod: "bank",
		PaymentMode:   "manual_bank",
		PaymentStatus: "pending",
		ExpiresAt:     &expTime,
	}
	if err := db.Create(&expOrder).Error; err != nil {
		t.Fatalf("create expired test order: %v", err)
	}
	if err := ProcessExpiredPendingOrders(db); err != nil {
		t.Fatalf("ProcessExpiredPendingOrders failed: %v", err)
	}
	var expNotif models.Notification
	if err := db.Where("id = ?", fmt.Sprintf("notif_sub_expired_%d", expOrder.ID)).First(&expNotif).Error; err != nil {
		t.Fatalf("expected expired notification: %v", err)
	}
	var expMail int64
	db.Model(&models.EmailJob{}).Where("recipient_email = ? AND category = 'subscription_expired'", u.Email).Count(&expMail)
	if expMail != 1 {
		t.Fatalf("expected 1 subscription_expired email, got %d", expMail)
	}

	// 4. Reject order -> creates rejected notif + email
	rejOrder := models.SubscriptionOrder{
		StoreID:       st.ID,
		UserID:        u.ID,
		OrderNumber:   "INV-SUB-REJ-902",
		Type:          "upgrade",
		PlanCode:      "pro_business",
		BillingCycle:  "monthly",
		FinalAmount:   129000,
		PaymentMethod: "qris",
		PaymentMode:   "manual_qris",
		PaymentStatus: "pending_verification",
	}
	if err := db.Create(&rejOrder).Error; err != nil {
		t.Fatalf("create reject test order: %v", err)
	}
	if _, err := RejectSubscriptionOrder(db, rejOrder.ID, 99, "Nominal tidak cocok"); err != nil {
		t.Fatalf("RejectSubscriptionOrder failed: %v", err)
	}
	var rejNotif models.Notification
	if err := db.Where("id = ?", fmt.Sprintf("notif_sub_rejected_%d", rejOrder.ID)).First(&rejNotif).Error; err != nil {
		t.Fatalf("expected rejected notification: %v", err)
	}
	var rejMail int64
	db.Model(&models.EmailJob{}).Where("recipient_email = ? AND category = 'subscription_rejected'", u.Email).Count(&rejMail)
	if rejMail != 1 {
		t.Fatalf("expected 1 subscription_rejected email, got %d", rejMail)
	}
}

func TestOnboardingAndBillingEmailBuilders_EscapeHTML(t *testing.T) {
	exp := time.Now().UTC().AddDate(0, 1, 0)
	order := &models.SubscriptionOrder{
		OrderNumber:     "INV-<script>alert(1)</script>",
		PlanCode:        "pro_business",
		FinalAmount:     129321,
		UniqueCode:      321,
		CouponCode:      "KUPON",
		DiscountAmount:  10000,
		PaymentStatus:   "pending_verification",
		RejectionReason: payloadXSS,
	}
	plan := &models.SubscriptionPlan{
		Code:               "pro_business",
		Name:               payloadXSS,
		MaxItems:           -1,
		StorageLimitBytes:  10 << 30,
		HasCustomDomain:    true,
		HasPrioritySupport: true,
	}

	builders := []struct {
		name string
		call func() (string, string)
	}{
		{"WelcomeFree", func() (string, string) {
			return BuildWelcomeStoreEmail(payloadXSS, payloadXSS, "toko-xss", "free", payloadXSS, 15, 100<<20, nil, payloadXSS)
		}},
		{"WelcomePending", func() (string, string) {
			return BuildWelcomeStoreEmail(payloadXSS, payloadXSS, "toko-xss", "free", "Gratis Terbatas", 15, 100<<20, order, payloadXSS)
		}},
		{"OrderPending", func() (string, string) {
			return BuildSubscriptionOrderPendingEmail(payloadXSS, payloadXSS, "toko-xss", order, payloadXSS)
		}},
		{"OrderActivated", func() (string, string) {
			return BuildSubscriptionActivatedEmail(payloadXSS, payloadXSS, "toko-xss", order, plan, &exp)
		}},
		{"OrderRejected", func() (string, string) {
			return BuildSubscriptionOrderRejectedEmail(payloadXSS, payloadXSS, "toko-xss", order, payloadXSS)
		}},
		{"OrderExpired", func() (string, string) {
			return BuildSubscriptionOrderExpiredEmail(payloadXSS, payloadXSS, "toko-xss", order, payloadXSS)
		}},
	}

	for _, b := range builders {
		t.Run(b.name, func(t *testing.T) {
			subj, body := b.call()
			if strings.TrimSpace(subj) == "" {
				t.Fatal("empty subject")
			}
			for _, raw := range []string{"<script>", "<img src=x onerror="} {
				if strings.Contains(body, raw) {
					t.Errorf("unescaped XSS payload %q found in HTML body", raw)
				}
			}
			if !strings.Contains(body, "&lt;script&gt;") {
				t.Error("expected escaped &lt;script&gt; entity in HTML body")
			}
		})
	}
}

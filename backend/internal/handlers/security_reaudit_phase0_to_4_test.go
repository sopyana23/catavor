package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// TestPhase0To4SecurityReauditRegressions membuktikan penutupan seluruh celah
// kritis dan tinggi hasil re-audit menyeluruh Fase 0 hingga Fase 4.
func TestPhase0To4SecurityReauditRegressions(t *testing.T) {
	t.Run("subscription_gateway_and_coupon_strip_unvalidated_proof_and_get_order_proof_enforces_tenant", func(t *testing.T) {
		db := newTestDB(t)
		privDir := t.TempDir()
		pubDir := t.TempDir()
		cfg := testCfg()
		cfg.StoragePrivateRoot = privDir
		cfg.StorageLocalRoot = pubDir

		// Siapkan berkas privat milik toko 1 (korban) dan berkas SVG berbahaya milik toko 2 (penyerang).
		victimRel := filepath.Join("stores", "1", "billing", "2026", "11", "victim-proof.jpg")
		if err := os.MkdirAll(filepath.Join(privDir, filepath.Dir(victimRel)), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(privDir, victimRel), []byte("\xff\xd8\xff\xe0VICTIM_SECRET_RECEIPT"), 0600); err != nil {
			t.Fatal(err)
		}

		victimUser := models.User{Name: "Korban", Email: "victim@catavor.test", PlatformRole: "merchant", TokenVersion: 1}
		attackerUser := models.User{Name: "Penyerang", Email: "attacker@catavor.test", PlatformRole: "merchant", TokenVersion: 1}
		db.Create(&victimUser)
		db.Create(&attackerUser)

		victimStore := models.Store{UserID: victimUser.ID, Slug: "toko-korban", StoreTitle: "Toko Korban", Plan: "free"}
		attackerStore := models.Store{UserID: attackerUser.ID, Slug: "toko-penyerang", StoreTitle: "Toko Penyerang", Plan: "free"}
		db.Create(&victimStore)
		db.Create(&attackerStore)
		db.Create(&models.SubscriptionPlan{Code: "pro_starter", Name: "Pro Starter", PriceMonthly: 49000})
		db.Create(&models.Setting{Key: "payment_system_mode", Value: "gateway_aulaa"})

		// 1. CreateSubscriptionOrder pada mode gateway_aulaa WAJIB mengosongkan PaymentProofURL liar.
		smuggledOrder, _, err := services.CreateSubscriptionOrder(db, attackerStore.ID, attackerUser.ID, services.CreateOrderRequest{
			PlanCode:        "pro_starter",
			BillingCycle:    "monthly",
			PaymentMethod:   "qris",
			PaymentProofURL: fmt.Sprintf("private/stores/%d/billing/2026/11/victim-proof.jpg", victimStore.ID),
		})
		if err != nil {
			t.Fatalf("CreateSubscriptionOrder gateway_aulaa: %v", err)
		}
		if smuggledOrder.PaymentProofURL != "" {
			t.Fatalf("PaymentProofURL pada mode gateway_aulaa wajib dikosongkan, aktual %q", smuggledOrder.PaymentProofURL)
		}

		// 2. Defense-in-depth pada GetOrderProof: meskipun baris DB diracuni secara manual dengan key tenant lain,
		// pembacaan lintas-toko WAJIB ditolak 404.
		poisonedOrder := models.SubscriptionOrder{
			StoreID:         attackerStore.ID,
			UserID:          attackerUser.ID,
			OrderNumber:     "INV-POISON-01",
			PlanCode:        "pro_starter",
			PaymentMethod:   "qris",
			PaymentMode:     "manual_qris",
			PaymentStatus:   "pending_verification",
			FinalAmount:     49000,
			PaymentProofURL: fmt.Sprintf("private/stores/%d/billing/2026/11/victim-proof.jpg", victimStore.ID),
		}
		db.Create(&poisonedOrder)

		subHandler := NewSubscriptionHandler(db, cfg)
		app := fiber.New()
		app.Get("/orders/:id/proof", func(c *fiber.Ctx) error {
			c.Locals("user", &attackerUser)
			c.Locals("store", &attackerStore)
			return subHandler.GetOrderProof(c)
		})

		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/orders/%d/proof", poisonedOrder.ID), nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != fiber.StatusNotFound {
			t.Fatalf("GetOrderProof lintas-toko harus ditolak 404, dapat %d", resp.StatusCode)
		}
	})

	t.Run("support_internal_note_confidentiality_staff_namespace_and_anti_rebinding", func(t *testing.T) {
		db := supportDB(t)
		privDir := filepath.Join(attachmentRoot(t), "priv_reaudit_internal_note")
		cfg := testCfg()
		cfg.StoragePrivateRoot = privDir

		staffNoteKey := "support/staff/2026/11/internal-audit.png"
		if err := os.MkdirAll(filepath.Join(privDir, filepath.Dir(staffNoteKey)), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(privDir, staffNoteKey), []byte("STAFF_CONFIDENTIAL_NOTE"), 0600); err != nil {
			t.Fatal(err)
		}

		merchant := models.User{Name: "Pemilik Tiket", Email: "owner-tkt@catavor.test", PlatformRole: "merchant", TokenVersion: 1}
		staff := models.User{Name: "Petugas Support", Email: "staff-tkt@catavor.test", PlatformRole: "support", TokenVersion: 1}
		db.Create(&merchant)
		db.Create(&staff)
		store := models.Store{UserID: merchant.ID, Slug: "toko-tkt", StoreTitle: "Toko Tiket", Plan: "free"}
		db.Create(&store)

		ticket := models.SupportTicket{
			TicketNumber: "TKT-REAUDIT-1",
			UserID:       merchant.ID,
			StoreID:      &store.ID,
			Subject:      "Kendala Katalog",
			Status:       "open",
		}
		db.Create(&ticket)

		internalMsg := models.SupportMessage{
			TicketID:       ticket.ID,
			SenderID:       staff.ID,
			SenderType:     "admin",
			Message:        "Catatan internal tim fraud",
			IsInternalNote: true,
		}
		db.Create(&internalMsg)
		internalAtt := models.SupportAttachment{
			MessageID:  internalMsg.ID,
			StorageKey: "private/" + staffNoteKey,
			FileName:   "internal-audit.png",
			FileType:   "image/png",
		}
		db.Create(&internalAtt)

		supH := NewSupportHandler(cfg, nil, db)
		app := fiber.New()
		app.Use(func(c *fiber.Ctx) error {
			if c.Get("X-Actor") == "staff" {
				c.Locals("user", &staff)
			} else {
				c.Locals("user", &merchant)
				c.Locals("store", &store)
			}
			return c.Next()
		})
		app.Post("/tickets", supH.CreateTicket)
		app.Get("/attachments/:id", supH.ServeAttachment)

		// 1. Merchant pemilik tiket DILARANG mengunduh lampiran catatan internal staf (wajib 404).
		reqMerch := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/attachments/%d", internalAtt.ID), nil)
		respMerch, _ := app.Test(reqMerch, -1)
		_ = respMerch.Body.Close()
		if respMerch.StatusCode != fiber.StatusNotFound {
			t.Fatalf("merchant tidak boleh membaca lampiran internal note staf (ingin 404, dapat %d)", respMerch.StatusCode)
		}

		// 2. Staf platform sendiri tetap dapat mengunduh lampiran internal note (200).
		reqStaff := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/attachments/%d", internalAtt.ID), nil)
		reqStaff.Header.Set("X-Actor", "staff")
		respStaff, _ := app.Test(reqStaff, -1)
		_ = respStaff.Body.Close()
		if respStaff.StatusCode != fiber.StatusOK {
			t.Fatalf("staf wajib bisa membaca lampiran internal note (ingin 200, dapat %d)", respStaff.StatusCode)
		}

		// 3. Merchant DILARANG mengikat namespace private/support/staff/ saat membuat tiket.
		staffNsPayload := `{"subject":"Uji","category":"general","priority":"low","message":"halo","attachments":[{"storage_key":"private/support/staff/2026/11/x.png","file_name":"x.png"}]}`
		reqBadNs := httptest.NewRequest(http.MethodPost, "/tickets", strings.NewReader(staffNsPayload))
		reqBadNs.Header.Set("Content-Type", "application/json")
		respBadNs, _ := app.Test(reqBadNs, -1)
		_ = respBadNs.Body.Close()
		if respBadNs.StatusCode != fiber.StatusBadRequest {
			t.Fatalf("merchant menyematkan private/support/staff/ wajib ditolak 400, dapat %d", respBadNs.StatusCode)
		}

		// 4. Anti-rebinding: storage_key yang sudah terikat pada tiket tidak boleh diikat ulang ke tiket kedua.
		pubMsg := models.SupportMessage{TicketID: ticket.ID, SenderID: merchant.ID, SenderType: "user", Message: "lampiran pertama"}
		db.Create(&pubMsg)
		db.Create(&models.SupportAttachment{
			MessageID:  pubMsg.ID,
			StorageKey: "private/support/tickets/2026/11/already-bound.png",
			FileName:   "already-bound.png",
			FileType:   "image/png",
		})
		rebindPayload := `{"subject":"Tiket Kedua","category":"general","priority":"low","message":"rebind","attachments":[{"storage_key":"private/support/tickets/2026/11/already-bound.png","file_name":"already-bound.png"}]}`
		reqRebind := httptest.NewRequest(http.MethodPost, "/tickets", strings.NewReader(rebindPayload))
		reqRebind.Header.Set("Content-Type", "application/json")
		respRebind, _ := app.Test(reqRebind, -1)
		_ = respRebind.Body.Close()
		if respRebind.StatusCode != fiber.StatusBadRequest {
			t.Fatalf("re-binding storage_key tiket lama wajib ditolak 400, dapat %d", respRebind.StatusCode)
		}
	})

	t.Run("product_handler_rejects_cross_tenant_and_platform_storage_urls", func(t *testing.T) {
		db := newTestDB(t)
		_ = db.AutoMigrate(&models.Category{}, &models.Product{}, &models.ProductImage{}, &models.ProductVariant{}, &models.SubscriptionPlan{})
		_ = services.SeedSubscriptionPlans(db)
		cfg := testCfg()
		owner := models.User{Name: "Pemilik", Email: "prod-owner@catavor.test", PlatformRole: "merchant", TokenVersion: 1}
		db.Create(&owner)
		store := models.Store{UserID: owner.ID, Slug: "toko-prod", StoreTitle: "Toko Prod", Plan: "free", PaymentStatus: "free_active"}
		db.Create(&store)

		prodH := NewProductHandler(cfg, db)
		app := fiber.New()
		app.Post("/products", func(c *fiber.Ctx) error {
			c.Locals("user", &owner)
			c.Locals("store", &store)
			return prodH.Store(c)
		})

		for _, forbiddenURL := range []string{
			"/storage/stores/99999/products/2026/11/other.jpg",
			"/storage/platform/branding/2026/11/logo.png",
			fmt.Sprintf("/storage/stores/%d/billing/2026/11/receipt.jpg", store.ID),
		} {
			body, _ := json.Marshal(map[string]interface{}{
				"name":         "Produk Uji",
				"product_type": "physical",
				"price":        15000,
				"image_url":    forbiddenURL,
			})
			req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatal(err)
			}
			_ = resp.Body.Close()
			if resp.StatusCode != fiber.StatusBadRequest {
				t.Fatalf("URL terlarang %q pada produk harus ditolak 400, dapat %d", forbiddenURL, resp.StatusCode)
			}
		}
	})

	t.Run("confirm_enrollment_burns_setup_after_3_failures_and_staff_forgot_password_blocked", func(t *testing.T) {
		db := newTestDB(t)
		cfg := testCfg()
		services.InitOTPService(db)
		app, authH, _ := newFullMFARoutingApp(t, db, cfg)
		app.Post("/direct-profile-otp", authH.RequestProfilePasswordOTP)

		// 1. Staf platform tanpa MFA: login -> setup_token -> enroll -> 3x salah kode pada ConfirmEnrollment wajib membakar setup_jti.
		staff := models.User{
			Name:         "Staf Enroll Lockout",
			Email:        "staff-enroll-lock@catavor.test",
			PlatformRole: "superadmin",
			TokenVersion: 1,
		}
		if err := staff.SetPassword("SandiKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		db.Create(&staff)

		_, loginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
		})
		setupTok, _ := loginBody["setup_token"].(string)
		if setupTok == "" {
			t.Fatalf("setup_token wajib ada untuk staf belum-MFA: %v", loginBody)
		}

		stEnr, enrBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/enroll", setupTok, map[string]interface{}{})
		if stEnr != fiber.StatusOK {
			t.Fatalf("enroll harus 200, dapat %d: %v", stEnr, enrBody)
		}

		var lastCode string
		for i := 1; i <= 3; i++ {
			wrong := fmt.Sprintf("00000%d", i)
			_, b, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/confirm", setupTok, map[string]interface{}{
				"code": wrong,
			})
			lastCode, _ = b["code"].(string)
		}
		if lastCode != "MFA_SETUP_EXPIRED" {
			t.Fatalf("percobaan salah ke-3 pada ConfirmEnrollment wajib membakar setup_jti (MFA_SETUP_EXPIRED), dapat %q", lastCode)
		}

		// 2. ForgotPasswordReset DILARANG mereset password akun staf platform ataupun menerbitkan setup_token.
		otpCode := "123456"
		sum := sha256.Sum256([]byte(otpCode))
		db.Create(&models.EmailVerificationOTP{
			Email:     strings.ToLower(staff.Email),
			OTPHash:   hex.EncodeToString(sum[:]),
			Purpose:   "password_reset",
			ExpiresAt: time.Now().UTC().Add(5 * time.Minute),
		})

		stReset, resetBody, _ := doJSONReq(t, app, "POST", "/api/auth/forgot-password-reset", "", map[string]interface{}{
			"email":            staff.Email,
			"otp":              otpCode,
			"new_password":     "BajakanEmail#2026!",
			"confirm_password": "BajakanEmail#2026!",
		})
		if stReset != fiber.StatusForbidden || resetBody["code"] != "STAFF_RECOVERY_RESTRICTED" {
			t.Fatalf("ForgotPasswordReset untuk staf platform wajib ditolak 403 STAFF_RECOVERY_RESTRICTED, dapat %d: %v", stReset, resetBody)
		}
		if resetBody["setup_token"] != nil {
			t.Fatal("ForgotPasswordReset DILARANG menerbitkan setup_token")
		}
		var reloadedStaff models.User
		db.First(&reloadedStaff, staff.ID)
		if !reloadedStaff.CheckPassword("SandiKuat#2026!") {
			t.Fatal("password staf tidak boleh berubah setelah upaya ForgotPasswordReset ditolak")
		}

		// 3. RequestProfilePasswordOTP tanpa sesi wajib 401 seragam baik lewat rute authOnly maupun handler langsung (anti-enumerasi).
		stAnonOTP, _, _ := doJSONReq(t, app, "POST", "/api/profile/request-password-otp", "", map[string]interface{}{
			"email": staff.Email,
		})
		stDirectOTP, _, _ := doJSONReq(t, app, "POST", "/direct-profile-otp", "", map[string]interface{}{
			"email": staff.Email,
		})
		if stAnonOTP != fiber.StatusUnauthorized || stDirectOTP != fiber.StatusUnauthorized {
			t.Fatalf("RequestProfilePasswordOTP tanpa sesi wajib 401, dapat route=%d handler=%d", stAnonOTP, stDirectOTP)
		}

		// 4. Logout tanpa token aktif tetap wajib menghapus cookie sesi HttpOnly.
		logoutReq := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
		logoutReq.Header.Set("Cookie", "catavor_session=expired-or-revoked-jwt")
		logoutResp, err := app.Test(logoutReq, -1)
		if err != nil {
			t.Fatal(err)
		}
		_ = logoutResp.Body.Close()
		if logoutResp.StatusCode != fiber.StatusOK {
			t.Fatalf("Logout dengan cookie basi wajib tetap 200, dapat %d", logoutResp.StatusCode)
		}
		if !strings.Contains(strings.ToLower(logoutResp.Header.Get("Set-Cookie")), "catavor_session=") {
			t.Fatalf("Logout wajib mengirim Set-Cookie penghapusan catavor_session, dapat %q", logoutResp.Header.Get("Set-Cookie"))
		}
	})
}

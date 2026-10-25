package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/handlers"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// 1. Initialize Zerolog output
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	log.Info().Msg("Starting Catavor Enterprise SaaS Backend (Golang 1.23+ & PostgreSQL)...")

	// 2. Load Configuration
	cfg := config.LoadConfig()

	// 3. Connect to Database (PostgreSQL) & Run Auto-Migration
	_, err := database.InitDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Fatal: Database initialization failed")
	}

	// 3.0 Initialize Redis Connection (with Graceful Fallback)
	database.InitRedis()

	// 3.1 Seed Default Subscription Plans
	if cfg.DBAutoMigrate {
		if err := services.SeedSubscriptionPlans(database.DB); err != nil {
			log.Warn().Err(err).Msg("Failed to seed default subscription plans")
		}
	}

	// 4. Initialize Fiber App with Industrial SaaS timeouts (WriteTimeout 0 for SSE streaming)
	app := fiber.New(fiber.Config{
		AppName:                 "Catavor Multi-Channel Commerce Server",
		BodyLimit:               12 * 1024 * 1024, // 12 MB max payload
		ReadTimeout:             0,                // Unlimited for streaming & SSE
		WriteTimeout:            0,                // Unlimited write deadline for persistent SSE streams (prevents net::ERR_INCOMPLETE_CHUNKED_ENCODING)
		IdleTimeout:             120 * time.Second,
		DisableStartupMessage:   false,
		ProxyHeader:             fiber.HeaderXForwardedFor,
		EnableTrustedProxyCheck: true,
		// N-15: daftar ini sebelumnya di-hardcode ke "127.0.0.1","::1" plus
		// seluruh RFC1918, sehingga header X-Forwarded-For dapat dipalsukan dari
		// jaringan lokal dan rate limiter berbasis IP bisa dilewati. Sekarang
		// dapat dikonfigurasi lewat TRUSTED_PROXIES (default hanya loopback).
		TrustedProxies: cfg.TrustedProxies,
	})

	// 5. Setup Security Middlewares (CORS, Headers, Recovery, Tracing, Logger)
	// M2: daftarkan dist dir agar hash script inline dihitung dari index.html
	// yang benar-benar disajikan (bukan hardcode yang cepat basi).
	middleware.SetCSPDistDirs(cfg.DesktopDistDir, cfg.TabletDistDir, cfg.MobileDistDir)
	middleware.SetupSecurityMiddlewares(app, cfg)

	// 6. Setup Storage & Handlers
	storageService, err := storage.NewStorageService(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Fatal: Storage service initialization failed")
	}

	authHandler := handlers.NewAuthHandler(cfg, database.DB)
	sessionHandler := handlers.NewSessionHandler(cfg, database.DB)
	storeHandler := handlers.NewStoreHandler(database.DB, cfg)
	// Muat cache master categories dari DB (single source of truth).
	handlers.LoadMasterCategoryCache(database.DB)
	handlers.LoadMasterPresetCache(database.DB)
	subscriptionHandler := handlers.NewSubscriptionHandler(database.DB)
	productHandler := handlers.NewProductHandler(cfg, database.DB)
	categoryHandler := handlers.NewCategoryHandler(database.DB)
	articleHandler := handlers.NewArticleHandler(database.DB)
	settingHandler := handlers.NewSettingHandler(database.DB)
	reportHandler := handlers.NewReportHandler(database.DB)
	supportHandler := handlers.NewSupportHandler(cfg, storageService, database.DB)
	analyticsHandler := handlers.NewAnalyticsHandler(cfg, database.DB)
	storageHandler := handlers.NewStorageHandler(cfg, storageService, database.DB)
	notificationHandler := handlers.NewNotificationHandler(database.DB)
	activityLogHandler := handlers.NewActivityLogHandler(database.DB)
	healthHandler := handlers.NewHealthHandler(database.DB)
	rbacHandler := handlers.NewRBACHandler(database.DB)
	dormancyHandler := handlers.NewDormancyHandler(database.DB)
	safeDomainHandler := handlers.NewSafeDomainHandler(database.DB)
	spaHandler := handlers.NewSPAHandler(cfg, database.DB)
	// Initialize Automation Tracker
	services.InitAutomationTracker(database.DB, storageService)

	// Start Background Transactional Email Queue Worker (Outbox Pattern with Exponential Retry)
	services.InitEmailQueue(database.DB)

	// Initialize OTP Service for Email Verification & Password Recovery
	services.InitOTPService(database.DB)

	// Start Background Notification Cleaner Worker (Purges expired and stale notifications every hour)
	services.StartNotificationCleaner(context.Background(), database.DB, 1*time.Hour)

	// Start Background Storage Sweeper Worker (Audits store disk storage and purges orphaned uploads every hour)
	services.StartStorageSweeper(context.Background(), database.DB, 1*time.Hour)

	// Start Background Activity Log Retention Cleaner Worker (Runs daily)
	services.StartActivityLogCleaner(context.Background(), database.DB, 24*time.Hour)

	// Start Background Dormancy & Free Tier Lifecycle Worker (Runs on boot and every 1 hour)
	services.StartDormancyWorker(context.Background(), database.DB, storageService, 1*time.Hour)

	// Start Background Support Ticket Enterprise Lifecycle Worker (Stale Reminder 3d, Auto-Resolve 5d, Auto-Close 7d, SLA Breach)
	supportHandler.StartSupportLifecycleWorker()

	// Start Background Subscription Lifecycle Worker (Runs on boot and every 1 hour)
	go func() {
		if err := services.ProcessSubscriptionLifecycle(database.DB); err != nil {
			log.Warn().Err(err).Msg("Initial subscription lifecycle check failed")
		}
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := services.ProcessSubscriptionLifecycle(database.DB); err != nil {
				log.Warn().Err(err).Msg("Subscription lifecycle periodic check failed")
			}
		}
	}()

	// Start Background Item Moderation Retention Worker (Runs on boot and every 24 hours: H-7 reminder, H-30 soft delete, H-90 hard delete)
	go func() {
		time.Sleep(30 * time.Second) // Stagger startup
		if stats, err := services.ProcessItemRetentionCycle(database.DB, cfg); err != nil {
			log.Warn().Err(err).Msg("Initial item retention cycle check failed")
		} else if stats != nil && (stats.RemindersSent > 0 || stats.SoftDeleted > 0 || stats.HardDeleted > 0) {
			log.Info().
				Int("reminders", stats.RemindersSent).
				Int("soft_deleted", stats.SoftDeleted).
				Int("hard_deleted", stats.HardDeleted).
				Msg("Item retention cycle completed on boot")
		}
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if stats, err := services.ProcessItemRetentionCycle(database.DB, cfg); err != nil {
				log.Warn().Err(err).Msg("Item retention periodic check failed")
			} else if stats != nil && (stats.RemindersSent > 0 || stats.SoftDeleted > 0 || stats.HardDeleted > 0) {
				log.Info().
					Int("reminders", stats.RemindersSent).
					Int("soft_deleted", stats.SoftDeleted).
					Int("hard_deleted", stats.HardDeleted).
					Msg("Periodic item retention cycle completed")
			}
		}
	}()

	// 7. Static Asset Directories with Hardened Security Headers
	// SECURITY (ST-01): route statis /storage hanya boleh menyajikan aset
	// publik. Bukti pembayaran dan lampiran tiket bantuan adalah berkas privat
	// yang hidup di StoragePrivateRoot dan hanya dapat diakses lewat endpoint
	// ber-otorisasi (GET /api/support/attachments/:id).
	//
	// Guard ini adalah lapisan kedua: berkas lama yang masih tertinggal di
	// pohon publik (hasil upload sebelum perbaikan ini) tetap tidak akan
	// pernah tersaji ke publik, sehingga migrasi tidak harus selesai lebih
	// dulu sebelum kebocoran tertutup.
	app.Use("/storage", func(c *fiber.Ctx) error {
		rel := strings.ToLower(strings.TrimLeft(strings.TrimPrefix(c.Path(), "/storage"), "/"))
		for _, prefix := range []string{"private/", "support/", "billing/"} {
			if strings.HasPrefix(rel, prefix) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Berkas tidak ditemukan."})
			}
		}
		return c.Next()
	})
	app.Static("/storage", cfg.StorageLocalRoot, fiber.Static{
		// Compress dimatikan: Fiber menulis cache .fiber.gz DI DALAM direktori
		// sumber, sehingga storage root terkotori berkas turunan yang bukan
		// objek asli (dan akan ikut tersinkron ke S3). Gambar/PDF tidak
		// untung dari kompresi on-the-fly.
		Compress:  false,
		ByteRange: true,
		MaxAge:    86400 * 30, // 30 days caching
		Browse:    false,      // Disable directory browsing
	})
	app.Static("/desktop", cfg.DesktopDistDir, fiber.Static{
		Compress:  true,
		ByteRange: true,
		MaxAge:    0,
	})
	app.Static("/tablet", cfg.TabletDistDir, fiber.Static{
		Compress:  true,
		ByteRange: true,
		MaxAge:    0,
	})
	app.Static("/mobile", cfg.MobileDistDir, fiber.Static{
		Compress:  true,
		ByteRange: true,
		MaxAge:    0,
	})

	// 8. Register API Endpoints
	app.Get("/ads.txt", settingHandler.GetAdsTxt)

	// Health probe untuk load balancer / orchestrator (tanpa auth, tanpa detail internal)
	app.Get("/healthz", handlers.LivenessHandler)
	app.Get("/readyz", healthHandler.Readiness)
	api := app.Group("/api", middleware.GlobalAPIRateLimiter())

	// Public Modern Product & Category Endpoints
	api.Get("/products", productHandler.Index)
	api.Get("/products/:id", productHandler.Show)
	api.Get("/products/:id/recommendations", productHandler.GetRecommendations)
	api.Get("/categories", categoryHandler.Index)
	api.Get("/master-categories", storeHandler.GetMasterCategoriesHandler)

	// Public Help Center / Knowledge Base Endpoints
	api.Get("/help/articles", supportHandler.GetHelpArticles)
	api.Get("/help/articles/:slug", supportHandler.GetHelpArticleBySlug)
	// N-16: VoteHelpful sebelumnya terbuka tanpa rate limiter sama sekali;
	// 40 POST berturut-turut dari satu IP menaikkan helpful_count 0 -> 40.
	api.Post("/help/articles/:id/helpful", middleware.PublicSubmissionRateLimiter(), supportHandler.VoteHelpful)

	api.Get("/settings", settingHandler.PublicIndex)
	api.Get("/policies", settingHandler.GetPolicies)
	api.Post("/policies/agree", middleware.PublicSubmissionRateLimiter(), settingHandler.RecordAgreement)
	api.Get("/articles", articleHandler.Index)
	api.Get("/articles/:id", articleHandler.Show)
	api.Get("/articles/:id/comments", articleHandler.GetArticleComments)
	api.Post("/articles/:id/comments", middleware.PublicSubmissionRateLimiter(), articleHandler.StoreComment)
	api.Post("/reports", middleware.PublicSubmissionRateLimiter(), reportHandler.CreateReport)

	// Multi-Tenant Public Store Endpoints
	api.Get("/stores/featured", storeHandler.FeaturedStores)
	api.Get("/check-slug/:slug", storeHandler.CheckSlug)
	api.Get("/u/:slug", storeHandler.ShowStore)
	api.Get("/u/:slug/products", storeHandler.IndexProducts)
	api.Get("/u/:slug/catalog-metrics", storeHandler.CatalogMetrics)
	api.Get("/u/:slug/categories", categoryHandler.Index)
	api.Get("/public/stores/reactivate", dormancyHandler.HandlePublicReactivateStore)
	api.Get("/stores/reactivate", dormancyHandler.HandlePublicReactivateStore)
	api.Get("/auth/reactivate-store", dormancyHandler.HandlePublicReactivateStore)

	// Public Subscription Plans
	api.Get("/subscription/plans", subscriptionHandler.GetPlans)

	// Public Telemetry & Analytics Tracking
	api.Post("/analytics/track", middleware.PublicSubmissionRateLimiter(), analyticsHandler.TrackEvent)
	api.Post("/client-logs", middleware.PublicSubmissionRateLimiter(), handlers.LogClientError)

	// Public Market Intelligence & Macro Trends (Aggregated & Zero PII)
	api.Get("/market-intelligence", analyticsHandler.GetMarketIntelligenceSummary)
	api.Get("/market-intelligence/summary", analyticsHandler.GetMarketIntelligenceSummary)
	api.Get("/market-intelligence/export", analyticsHandler.ExportMarketIntelligenceData)

	// Public Master Safe Domains (Ecosystem Whitelist)
	api.Get("/safe-domains", safeDomainHandler.GetPublicSafeDomains)
	api.Get("/public/safe-domains", safeDomainHandler.GetPublicSafeDomains)

	// Authentication Endpoints with Rate Limiter
	api.Post("/login", middleware.AuthRateLimiter(), authHandler.Login)
	api.Post("/auth/login", middleware.AuthRateLimiter(), authHandler.Login)
	api.Post("/register", middleware.AuthRateLimiter(), authHandler.Register)
	api.Post("/auth/register", middleware.AuthRateLimiter(), authHandler.Register)
	api.Post("/auth/google", middleware.AuthRateLimiter(), authHandler.GoogleAuth)
	api.Post("/auth/send-registration-otp", middleware.AuthRateLimiter(), authHandler.SendRegistrationOTP)
	api.Post("/send-register-otp", middleware.AuthRateLimiter(), authHandler.SendRegistrationOTP)
	api.Post("/auth/verify-registration-otp", middleware.AuthRateLimiter(), authHandler.VerifyRegistrationOTP)
	api.Post("/verify-register-otp", middleware.AuthRateLimiter(), authHandler.VerifyRegistrationOTP)
	api.Post("/auth/forgot-password-request", middleware.AuthRateLimiter(), authHandler.ForgotPasswordRequest)
	api.Post("/forgot-password", middleware.AuthRateLimiter(), authHandler.ForgotPasswordRequest)
	api.Post("/auth/forgot-password-reset", middleware.AuthRateLimiter(), authHandler.ForgotPasswordReset)
	api.Post("/reset-password", middleware.AuthRateLimiter(), authHandler.ForgotPasswordReset)
	api.Post("/profile/request-password-otp", middleware.AuthRateLimiter(), authHandler.RequestProfilePasswordOTP)

	// Public Slug Availability Checking
	api.Get("/check-slug/:slug", storeHandler.CheckSlug)
	api.Get("/check-slug", storeHandler.CheckSlug)
	api.Get("/auth/check-slug/:slug", storeHandler.CheckSlug)
	api.Get("/auth/check-slug", storeHandler.CheckSlug)

	// User Auth-Guarded Endpoints (Requires valid JWT Token)
	authOnly := api.Group("", middleware.AuthRequired(cfg))
	{
		authOnly.Get("/auth/verify", authHandler.VerifyToken)
		authOnly.Get("/auth/me", authHandler.VerifyToken)
		authOnly.Post("/auth/refresh", authHandler.RefreshToken)
		authOnly.Post("/logout", authHandler.Logout)
		authOnly.Post("/profile", authHandler.UpdateProfile)
		authOnly.Put("/profile", authHandler.UpdateProfile)
		authOnly.Post("/profile/request-password-otp", middleware.AuthRateLimiter(), authHandler.RequestProfilePasswordOTP)

		// Multi-Store User Management
		authOnly.Get("/user/stores", storeHandler.GetMyStores)
		authOnly.Get("/user/stores/check-slug", storeHandler.CheckSlug)
		authOnly.Post("/user/stores", storeHandler.CreateStore)
		authOnly.Post("/user/stores/create", storeHandler.CreateStore)
		authOnly.Post("/user/stores/switch", storeHandler.SwitchStore)

		// Connected Devices & Active Session Management
		authOnly.Get("/user/sessions", sessionHandler.GetSessions)
		authOnly.Post("/user/sessions/:id/revoke", sessionHandler.RevokeSession)
		authOnly.Post("/user/sessions/revoke-others", sessionHandler.RevokeOtherSessions)

		// Danger Zone: Single Store & Entire User Account Deletion
		authOnly.Delete("/stores/:id", storeHandler.DeleteStore)
		authOnly.Post("/stores/:id/delete", storeHandler.DeleteStore)
		authOnly.Delete("/user/account", authHandler.DeleteAccount)
		authOnly.Post("/user/account/delete", authHandler.DeleteAccount)

		// Dynamic Notifications & Real-Time SSE (User-Level Rights: Available during suspension/appeal)
		authOnly.Get("/notifications", notificationHandler.GetNotifications)
		authOnly.Post("/notifications/read-all", notificationHandler.MarkAllAsRead)
		authOnly.Post("/notifications/clear-read", notificationHandler.ClearReadNotifications)
		authOnly.Post("/notifications/:id/read", notificationHandler.MarkAsRead)
		authOnly.Post("/notifications/:id/dismiss", notificationHandler.Dismiss)
		// SECURITY (M1/SSE): tukar sesi cookie dengan tiket sekali pakai,
		// supaya JWT tidak perlu muncul di URL stream.
		authOnly.Post("/notifications/ticket", notificationHandler.IssueStreamTicket)
		authOnly.Post("/v1/notifications/ticket", notificationHandler.IssueStreamTicket)
		authOnly.Get("/notifications/stream", notificationHandler.Stream)
		authOnly.Get("/v1/notifications/stream", notificationHandler.Stream)
		authOnly.Get("/v1/notifications", notificationHandler.GetNotifications)
	}

	// Guarded Admin & Merchant Endpoints (Requires JWT Token & Store Ownership)
	guarded := api.Group("", middleware.AuthRequired(cfg), middleware.StoreOwnerRequired())
	// Guarded Mutation Endpoints (Requires Active/Operational Store - Blocks Banned/Suspended Stores)
	guardedMutations := api.Group("", middleware.AuthRequired(cfg), middleware.StoreOwnerRequired(), middleware.OperationalStoreRequired())
	{
		// Storage & Cloud Object Endpoints (S3 / MinIO / Local)
		guardedMutations.Post("/storage/upload", storageHandler.Upload)
		guardedMutations.Delete("/storage/file", storageHandler.DeleteFile)

		// CRUD Modern Product & Category
		guardedMutations.Post("/products", productHandler.Store)
		guardedMutations.Put("/products/:id", productHandler.Update)
		guardedMutations.Post("/products/:id/resubmit-review", productHandler.ResubmitForReview)
		guardedMutations.Delete("/products/:id", productHandler.Destroy)

		guarded.Get("/admin/categories", categoryHandler.Index)
		guardedMutations.Post("/categories", categoryHandler.Store)
		guardedMutations.Put("/categories/:id", categoryHandler.Update)
		guardedMutations.Delete("/categories/:id", categoryHandler.Destroy)

		// Support Tickets & Live Chat Conversations (with normalized attachments)
		guarded.Get("/support/tickets", supportHandler.ListMyTickets)
		guarded.Get("/support/tickets/:id", supportHandler.GetTicketDetails)
		guarded.Post("/support/tickets", supportHandler.CreateTicket)
		guarded.Post("/support/tickets/:id/reply", supportHandler.ReplyTicket)
		guarded.Post("/support/tickets/:id/mark-read", supportHandler.MarkTicketAsRead)
		guarded.Post("/support/tickets/:id/rating", supportHandler.RateTicket)
		guarded.Get("/support/tickets-ping", supportHandler.GetSupportTicketsPing)
		guarded.Get("/support/attachments/:id", supportHandler.ServeAttachment)

		// Admin Support Moderation, Quick Reply Canned Responses & Collision Detection
		// SECURITY (N-06): rute moderasi support adalah area PLATFORM, bukan area
		// merchant. Sebelumnya 11 rute di bawah ini hanya memakai AuthRequired
		// (grup "guarded"), sehingga merchant yang login bisa membaca seluruh
		// tiket tenant lain, membaca template canned response, dan — dengan
		// header Origin yang sah — MEMBUAT/MENGUBAH/MENGHAPUS template platform.
		// Sudah dibuktikan runtime: POST /api/admin/support/templates -> 201.
		// Kini wajib izin support:tickets:* seperti pada grup adminApi.
		// Support & Helpdesk (platform): seluruh /admin/support/* sudah punya
		// padanan ber-otorisasi di grup adminApi. Pendaftaran di grup "guarded"
		// dihapus — grup itu mensyaratkan StoreOwnerRequired sehingga staf
		// platform tanpa toko tertolak 403 "Toko Anda belum terdaftar."

		// Multi-Tenant Store Settings & Two-Tier Master Data
		guardedMutations.Post("/stores/update", storeHandler.UpdateStore)
		guardedMutations.Post("/stores/upgrade-plan", subscriptionHandler.UpgradePlan)
		guardedMutations.Post("/stores/add-master-option", storeHandler.AddMasterOption)
		guardedMutations.Post("/stores/rename-master-option", storeHandler.RenameMasterOption)
		guardedMutations.Post("/stores/delete-master-option", storeHandler.DeleteMasterOption)
		guardedMutations.Post("/stores/apply-master-preset", storeHandler.ApplyMasterPreset)

		// Multi-Tier Subscription, Quota & Custom Domain Management
		guarded.Get("/subscription/my-quota", subscriptionHandler.GetStoreQuota)
		guardedMutations.Post("/subscription/upgrade", subscriptionHandler.UpgradePlan)
		guardedMutations.Post("/subscription/schedule-downgrade", subscriptionHandler.ScheduleDowngrade)
		guardedMutations.Post("/subscription/cancel-downgrade", subscriptionHandler.CancelDowngrade)
		guardedMutations.Post("/subscription/custom-domain", subscriptionHandler.UpdateCustomDomain)
		guardedMutations.Post("/subscription/order", subscriptionHandler.CreateOrder)
		guarded.Get("/subscription/orders", subscriptionHandler.GetOrders)

		// Merchant Analytics & Store Telemetry
		guarded.Get("/admin/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/admin/analytics", analyticsHandler.GetStoreAnalytics)
		guarded.Get("/analytics", analyticsHandler.GetStoreAnalytics)
		guarded.Get("/admin/analytics/export", analyticsHandler.ExportStoreAnalytics)
		guarded.Get("/analytics/export", analyticsHandler.ExportStoreAnalytics)

		// Settings & Policies
		// SECURITY (N-18): menulis pengaturan platform adalah wewenang "system",
		// bukan merchant. Sebelumnya hanya dijaga StoreOwnerRequired sehingga
		// merchant dapat menulis master settings.
		guardedMutations.Post("/settings",
			middleware.RequirePermission(cfg, "system:settings:manage"), settingHandler.Store)
		guardedMutations.Post("/settings/policies",
			middleware.RequirePermission(cfg, "system:settings:manage"), settingHandler.UpdatePolicy)
		guarded.Get("/settings/policy-audit-logs", settingHandler.GetPolicyAuditLogs)

		// Articles & Moderation
		// SECURITY (N-18): artikel edukasi adalah konten platform. Ketiga rute
		// tulis sebelumnya tanpa cek peran sama sekali — merchant bisa
		// menerbitkan, mengubah, dan MENGHAPUS artikel platform (terbukti
		// runtime: PUT /api/articles/1 -> 200). Handler-nya pun tidak memeriksa
		// peran, jadi penjagaan harus di middleware.
		guardedMutations.Post("/articles",
			middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.Store)
		guardedMutations.Put("/articles/:id",
			middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.Update)
		guardedMutations.Delete("/articles/:id",
			middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.Destroy)
		// SECURITY (N-07): moderasi komentar artikel adalah wewenang platform
		// (content), bukan merchant. Rute /admin/comments sudah DIPINDAH ke
		// grup adminApi (lihat bagian "Content & Broadcast") karena handler-nya
		// tidak memakai store_id konteks. Sebelumnya di sini sehingga
		// superadmin tanpa toko tertolak 403 "Toko Anda belum terdaftar."

		// SECURITY (N-07): rute /reports di grup "guarded" tidak memfilter tenant
		// sama sekali. Terbukti runtime: merchant membaca 26 laporan dari SEMUA
		// toko (termasuk reporter_email/ip/user-agent dan admin_notes internal)
		// serta mengubah status laporan toko lain menjadi "dismissed".
		// Versi ber-otorisasi sudah ada di adminApi dengan compliance:reports:manage;
		// rute duplikat ini dihapus, bukan diberi gate ganda.

		// ===================================================================
		// ARSITEKTUR (Opsi A — pemisahan bidang otorisasi)
		// Rute /admin/* di bawah ini SUDAH ada di grup adminApi (baris ~489)
		// dengan AuthRequired + RequireAdmin + RequirePermission per-rute.
		// Pendaftaran ganda di grup "guarded" (yang mensyaratkan
		// StoreOwnerRequired) membuat Fiber memakai handler PERTAMA — sehingga
		// jalur admin platform justru diwajibkan punya toko katalog.
		// Terbukti runtime: superadmin tanpa toko -> 403 "Toko Anda belum
		// terdaftar." walau Role sudah punya izin. Duplikat dihapus; satu
		// sumber kebenaran ada di adminApi.
		// Dihapus: notifications (5), stores/users search (4), automation (3),
		// audit-logs (1), market-intelligence (2), safe-domains (5),
		// support tickets+templates (11) — seluruhnya duplikat.
		// Dipertahankan di grup ini: /admin/analytics* dan /admin/categories
		// karena memang memakai store_id konteks merchant (lihat komentar
		// "Merchant Analytics" di atas).
		// ===================================================================

		// Store Activity Extension & Superadmin Dormancy Metrics
		guardedMutations.Post("/stores/extend-activity", dormancyHandler.HandleExtendStoreActivity)
		guardedMutations.Post("/store/extend-activity", dormancyHandler.HandleExtendStoreActivity)

		// Enterprise Activity Logs (scoped ke toko sendiri — tetap di grup merchant)
		guarded.Get("/activity-logs", activityLogHandler.GetStoreActivityLogs)
		guarded.Get("/activity-logs/summary", activityLogHandler.GetActivitySummary)
	}

	// 8.1 Dedicated Platform Admin API Group (Granular RBAC Protected)
	adminApi := api.Group("/admin", middleware.AuthRequired(cfg), middleware.RequireAdmin(cfg))
	{
		// System Bot & Automation Engine Monitoring & Sandbox
		adminApi.Get("/automation/status", notificationHandler.GetAutomationStatus)
		adminApi.Get("/automation/logs", notificationHandler.GetAutomationLogs)
		adminApi.Post("/automation/trigger", notificationHandler.TriggerAutomationBot)

		// Dynamic RBAC Matrix & Staff Management (Superadmin / Staff Governance)
		adminApi.Get("/rbac/me", rbacHandler.GetMyPermissions)
		adminApi.Get("/rbac/matrix", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.GetMatrix)
		adminApi.Post("/rbac/matrix", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.UpdateMatrix)
		adminApi.Get("/rbac/roles", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.GetMatrix)
		adminApi.Post("/rbac/roles", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.CreateRole)
		adminApi.Get("/rbac/staff", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.GetStaff)
		adminApi.Post("/rbac/staff", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.AssignStaff)
		adminApi.Post("/rbac/staff/assign", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.AssignStaff)
		adminApi.Post("/rbac/staff/revoke", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.RevokeStaff)
		adminApi.Post("/rbac/staff/:id/revoke", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.RevokeStaff)
		adminApi.Delete("/rbac/staff/:id", middleware.RequirePermission(cfg, "system:admins:manage"), rbacHandler.RevokeStaff)

		// Compliance & Trust / Safety (Satwa & Laporan)
		adminApi.Get("/reports", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.Index)
		adminApi.Get("/reports/:id", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.Show)
		adminApi.Put("/reports/:id", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.UpdateStatus)
		adminApi.Get("/dormancy/metrics", middleware.RequirePermission(cfg, "compliance:dormancy:manage"), dormancyHandler.HandleGetDormancyMetrics)
		adminApi.Get("/superadmin/dormancy/metrics", middleware.RequirePermission(cfg, "compliance:dormancy:manage"), dormancyHandler.HandleGetDormancyMetrics)

		// Support & Helpdesk
		adminApi.Get("/support/tickets", middleware.RequirePermission(cfg, "support:tickets:read"), supportHandler.ListAllTickets)
		adminApi.Get("/support/tickets/:id", middleware.RequirePermission(cfg, "support:tickets:read"), supportHandler.GetAdminTicketDetails)
		adminApi.Post("/support/tickets/:id/reply", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.ReplyAsAdmin)
		adminApi.Put("/support/tickets/:id/status", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.UpdateTicketStatus)
		adminApi.Post("/support/tickets/:id/presence", middleware.RequirePermission(cfg, "support:tickets:read"), supportHandler.UpdatePresence)
		adminApi.Get("/support/tickets/:id/presence", middleware.RequirePermission(cfg, "support:tickets:read"), supportHandler.GetPresence)
		adminApi.Get("/support/templates", middleware.RequirePermission(cfg, "support:tickets:read"), supportHandler.ListCannedResponses)
		adminApi.Post("/support/templates", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.CreateCannedResponse)
		adminApi.Put("/support/templates/:id", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.UpdateCannedResponse)
		adminApi.Delete("/support/templates/:id", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.DeleteCannedResponse)
		adminApi.Post("/support/templates/reset-defaults", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.ResetDefaultCannedResponses)

		// Content & Broadcast
		adminApi.Get("/notifications", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminIndex)
		adminApi.Get("/notifications/:id", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminGetOne)
		adminApi.Post("/notifications/broadcast", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminBroadcast)
		adminApi.Delete("/notifications/:id", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminDelete)
		adminApi.Get("/stores/search", notificationHandler.SearchStores)
		adminApi.Get("/users/search", notificationHandler.SearchUsers)

		// Store Management / Directory Catalog Profiles (Server-Side Paginated & Filtered)
		adminApi.Get("/stores", storeHandler.AdminListStores)
		adminApi.Get("/stores/:id", storeHandler.AdminGetStoreDetail)

		// Moderasi Komentar Artikel (wewenang platform/content, tidak butuh toko)
		// Dipindah dari grup "guarded" (StoreOwnerRequired) sesuai OWASP:
		// jalur admin lintas-tenant harus explicit & separately authorized.
		adminApi.Get("/comments", middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.GetAdminComments)
		adminApi.Post("/comments/:id/approve", middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.ApproveComment)
		adminApi.Delete("/comments/:id", middleware.RequirePermission(cfg, "content:articles:manage"), articleHandler.DeleteComment)

		// Monetization, Rekber Syariah & Platform Settings
		// SECURITY (N-12): settings mengubah konfigurasi platform (monetisasi, iklan,
		// kredensial partner) -> wajib izin khusus, bukan sekadar staf platform.
		adminApi.Get("/settings", middleware.RequirePermission(cfg, "system:settings:manage"), settingHandler.Index)
		adminApi.Post("/settings", middleware.RequirePermission(cfg, "system:settings:manage"), settingHandler.Store)
		adminApi.Post("/settings/rekber/reset-defaults", middleware.RequirePermission(cfg, "system:settings:manage"), settingHandler.ResetRekberDefaults)

		// Master Safe Domains (Ecosystem URL Whitelist)
		// SECURITY (N-29): daftar ini adalah whitelist domain tepercaya yang dipakai
		// frontend (safeHref) untuk MEMBUKA tautan tanpa peringatan konfirmasi anti-
		// phishing. Siapa pun yang bisa menulis ke sini bisa menambahkan domain
		// penyerang dan mematikan guard redirect untuk seluruh pengguna platform.
		// Karena itu seluruh mutasi WAJIB memakai izin master settings — bukan
		// sekadar "staf platform". Sebelumnya 5 rute ini terdaftar dua kali tanpa
		// RequirePermission sehingga semua staf (support/content/finance) bisa
		// mengubahnya. Duplikat dihapus, satu sumber kebenaran di sini.
		adminApi.Get("/safe-domains", middleware.RequirePermission(cfg, "system:settings:manage"), safeDomainHandler.GetAdminSafeDomains)
		adminApi.Post("/safe-domains", middleware.RequirePermission(cfg, "system:settings:manage"), safeDomainHandler.CreateSafeDomain)
		adminApi.Put("/safe-domains/:id", middleware.RequirePermission(cfg, "system:settings:manage"), safeDomainHandler.UpdateSafeDomain)
		adminApi.Delete("/safe-domains/:id", middleware.RequirePermission(cfg, "system:settings:manage"), safeDomainHandler.DeleteSafeDomain)
		adminApi.Post("/safe-domains/reset-defaults", middleware.RequirePermission(cfg, "system:settings:manage"), safeDomainHandler.ResetDefaultSafeDomains)

		// Finance & Billing
		adminApi.Get("/subscription/orders", middleware.RequirePermission(cfg, "finance:orders:read"), subscriptionHandler.AdminListOrders)
		adminApi.Post("/subscription/orders/:id/approve", middleware.RequirePermission(cfg, "finance:orders:manage"), subscriptionHandler.ApproveOrder)

		// Audit & Market Intelligence
		adminApi.Get("/audit-logs", middleware.RequirePermission(cfg, "audit:logs:read"), activityLogHandler.GetSuperadminAuditLogs)
		adminApi.Get("/market-intelligence", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.GetMarketIntelligenceSummary)
		adminApi.Get("/market-intelligence/export", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.ExportMarketIntelligenceData)
	}

	// 9. SPA Wildcard Fallback Router for Desktop & Mobile clients
	app.Get("/*", spaHandler.ServeSPA)

	// 10. Graceful Shutdown & Server Listen
	listenAddr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	useTLS := cfg.TLSCertFile != "" && cfg.TLSKeyFile != ""
	scheme := "http"
	if useTLS {
		scheme = "https"
	}

	go func() {
		var err error
		if useTLS {
			// TLS langsung dari proses: dipakai bila tidak ada reverse proxy.
			err = app.ListenTLS(listenAddr, cfg.TLSCertFile, cfg.TLSKeyFile)
		} else {
			err = app.Listen(listenAddr)
		}
		if err != nil {
			log.Info().Err(err).Msg("Server shutting down")
		}
	}()

	log.Info().
		Str("address", fmt.Sprintf("%s://localhost:%s", scheme, cfg.Port)).
		Bool("tls", useTLS).
		Str("environment", cfg.AppEnv).
		Msg("Catavor Golang Server is LIVE and ready!")

	// Graceful shutdown channel
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Gracefully shutting down server...")
	_ = app.ShutdownWithTimeout(5 * time.Second)
	log.Info().Msg("Server stopped.")
}

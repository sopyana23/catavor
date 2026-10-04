package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
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
		AppName:               "Catavor Multi-Channel Commerce Server",
		BodyLimit:             12 * 1024 * 1024, // 12 MB max payload
		ReadTimeout:           0,                 // Unlimited for streaming & SSE
		WriteTimeout:          0,                 // Unlimited write deadline for persistent SSE streams (prevents net::ERR_INCOMPLETE_CHUNKED_ENCODING)
		IdleTimeout:           120 * time.Second,
		DisableStartupMessage: false,
	})

	// 5. Setup Security Middlewares (CORS, Headers, Recovery, Tracing, Logger)
	middleware.SetupSecurityMiddlewares(app, cfg)

	// 6. Setup Storage & Handlers
	storageService, err := storage.NewStorageService(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Fatal: Storage service initialization failed")
	}

	authHandler := handlers.NewAuthHandler(cfg)
	storeHandler := handlers.NewStoreHandler(cfg)
	subscriptionHandler := handlers.NewSubscriptionHandler()
	productHandler := handlers.NewProductHandler(cfg)
	categoryHandler := handlers.NewCategoryHandler()
	faunaHandler := handlers.NewFaunaHandler(cfg)
	articleHandler := handlers.NewArticleHandler()
	settingHandler := handlers.NewSettingHandler()
	reportHandler := handlers.NewReportHandler()
	supportHandler := handlers.NewSupportHandler(cfg)
	analyticsHandler := handlers.NewAnalyticsHandler(cfg)
	storageHandler := handlers.NewStorageHandler(cfg, storageService, database.DB)
	notificationHandler := handlers.NewNotificationHandler(database.DB)
	activityLogHandler := handlers.NewActivityLogHandler(database.DB)
	rbacHandler := handlers.NewRBACHandler()
	safeDomainHandler := handlers.NewSafeDomainHandler()
	spaHandler := handlers.NewSPAHandler(cfg, database.DB)
	// Initialize Automation Tracker
	services.InitAutomationTracker(database.DB, storageService)

	// Start Background Transactional Email Queue Worker (Outbox Pattern with Exponential Retry)
	services.InitEmailQueue(database.DB)

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
	app.Static("/storage", cfg.StorageLocalRoot, fiber.Static{
		Compress:  true,
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
	api := app.Group("/api")

	// Public Modern Product & Category Endpoints
	api.Get("/products", productHandler.Index)
	api.Get("/products/:id", productHandler.Show)
	api.Get("/products/:id/recommendations", productHandler.GetRecommendations)
	api.Get("/categories", categoryHandler.Index)

	// Public Help Center / Knowledge Base Endpoints
	api.Get("/help/articles", supportHandler.GetHelpArticles)
	api.Get("/help/articles/:slug", supportHandler.GetHelpArticleBySlug)
	api.Post("/help/articles/:id/helpful", supportHandler.VoteHelpful)

	// Public Legacy Endpoints (Maintained for Backward Compatibility)
	api.Get("/fauna", productHandler.Index)
	api.Get("/fauna/:id", productHandler.Show)
	api.Get("/fauna/:id/recommendations", productHandler.GetRecommendations)
	api.Get("/taxonomy/culinary", faunaHandler.GetCulinaryTaxonomy)
	api.Get("/culinary-taxonomy", faunaHandler.GetCulinaryTaxonomy)
	api.Get("/settings", settingHandler.Index)
	api.Get("/policies", settingHandler.GetPolicies)
	api.Post("/policies/agree", middleware.PublicSubmissionRateLimiter(), settingHandler.RecordAgreement)
	api.Get("/articles", articleHandler.Index)
	api.Get("/articles/:id", articleHandler.Show)
	api.Get("/articles/:id/comments", articleHandler.GetArticleComments)
	api.Post("/articles/:id/comments", middleware.PublicSubmissionRateLimiter(), articleHandler.StoreComment)
	api.Post("/sightings", middleware.PublicSubmissionRateLimiter(), settingHandler.StoreSighting)
	api.Post("/reports", middleware.PublicSubmissionRateLimiter(), reportHandler.CreateReport)

	// Multi-Tenant Public Store Endpoints
	api.Get("/stores/featured", storeHandler.FeaturedStores)
	api.Get("/check-slug/:slug", storeHandler.CheckSlug)
	api.Get("/u/:slug", storeHandler.ShowStore)
	api.Get("/u/:slug/products", storeHandler.IndexProducts)
	api.Get("/u/:slug/catalog-metrics", storeHandler.CatalogMetrics)
	api.Get("/u/:slug/categories", categoryHandler.Index)
	api.Get("/u/:slug/fauna", storeHandler.IndexProducts) // Backward-compatible alias
	api.Get("/public/stores/reactivate", handlers.HandlePublicReactivateStore)
	api.Get("/stores/reactivate", handlers.HandlePublicReactivateStore)
	api.Get("/auth/reactivate-store", handlers.HandlePublicReactivateStore)

	// Public Subscription Plans
	api.Get("/subscription/plans", subscriptionHandler.GetPlans)

	// Public Telemetry & Analytics Tracking
	api.Post("/analytics/track", middleware.PublicSubmissionRateLimiter(), analyticsHandler.TrackEvent)

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

		// Multi-Store User Management
		authOnly.Get("/user/stores", storeHandler.GetMyStores)
		authOnly.Get("/user/stores/check-slug", storeHandler.CheckSlug)
		authOnly.Post("/user/stores", storeHandler.CreateStore)
		authOnly.Post("/user/stores/create", storeHandler.CreateStore)
		authOnly.Post("/user/stores/switch", storeHandler.SwitchStore)

		// Dynamic Notifications & Real-Time SSE (User-Level Rights: Available during suspension/appeal)
		authOnly.Get("/notifications", notificationHandler.GetNotifications)
		authOnly.Post("/notifications/read-all", notificationHandler.MarkAllAsRead)
		authOnly.Post("/notifications/clear-read", notificationHandler.ClearReadNotifications)
		authOnly.Post("/notifications/:id/read", notificationHandler.MarkAsRead)
		authOnly.Post("/notifications/:id/dismiss", notificationHandler.Dismiss)
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
		guarded.Post("/storage/upload", storageHandler.Upload)
		guardedMutations.Delete("/storage/file", storageHandler.DeleteFile)
		guarded.Post("/upload-image", storageHandler.Upload) // Backward compatibility alias

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
		guarded.Get("/admin/support/tickets", supportHandler.ListAllTickets)
		guarded.Get("/admin/support/tickets/:id", supportHandler.GetAdminTicketDetails)
		guarded.Post("/admin/support/tickets/:id/reply", supportHandler.ReplyAsAdmin)
		guarded.Put("/admin/support/tickets/:id/status", supportHandler.UpdateTicketStatus)
		guarded.Post("/admin/support/tickets/:id/presence", supportHandler.UpdatePresence)
		guarded.Get("/admin/support/tickets/:id/presence", supportHandler.GetPresence)
		guarded.Get("/admin/support/templates", supportHandler.ListCannedResponses)
		guarded.Post("/admin/support/templates", supportHandler.CreateCannedResponse)
		guarded.Put("/admin/support/templates/:id", supportHandler.UpdateCannedResponse)
		guarded.Delete("/admin/support/templates/:id", supportHandler.DeleteCannedResponse)
		guarded.Post("/admin/support/templates/reset-defaults", supportHandler.ResetDefaultCannedResponses)

		// CRUD Item Catalog (Legacy Aliases)
		guardedMutations.Post("/fauna", productHandler.Store)
		guardedMutations.Put("/fauna/:id", productHandler.Update)
		guardedMutations.Delete("/fauna/:id", productHandler.Destroy)

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
		guarded.Post("/subscription/schedule-downgrade", subscriptionHandler.ScheduleDowngrade)
		guarded.Post("/subscription/cancel-downgrade", subscriptionHandler.CancelDowngrade)
		guardedMutations.Post("/subscription/custom-domain", subscriptionHandler.UpdateCustomDomain)
		guardedMutations.Post("/subscription/order", subscriptionHandler.CreateOrder)
		guarded.Get("/subscription/orders", subscriptionHandler.GetOrders)

		// Merchant Analytics & Store Telemetry
		guarded.Get("/admin/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/admin/analytics", analyticsHandler.GetStoreAnalytics)
		guarded.Get("/analytics", analyticsHandler.GetStoreAnalytics)

		// Settings & Policies
		guardedMutations.Post("/settings", settingHandler.Store)
		guardedMutations.Post("/settings/policies", settingHandler.UpdatePolicy)
		guarded.Get("/settings/policy-audit-logs", settingHandler.GetPolicyAuditLogs)

		// Articles & Moderation
		guardedMutations.Post("/articles", articleHandler.Store)
		guardedMutations.Put("/articles/:id", articleHandler.Update)
		guardedMutations.Delete("/articles/:id", articleHandler.Destroy)
		guarded.Get("/admin/comments", articleHandler.GetAdminComments)
		guardedMutations.Post("/admin/comments/:id/approve", articleHandler.ApproveComment)
		guardedMutations.Delete("/admin/comments/:id", articleHandler.DeleteComment)

		// Reports & Compliance Moderation
		guarded.Get("/reports", reportHandler.Index)
		guarded.Get("/reports/:id", reportHandler.Show)
		guarded.Put("/reports/:id", reportHandler.UpdateStatus)
		guarded.Post("/reports/review-item", reportHandler.ReviewRemediatedItem)


		// Superadmin Broadcast Notifications (Backward Compatibility Alias)
		guarded.Get("/notifications/:id", notificationHandler.SuperadminGetOne)
		guarded.Get("/admin/notifications", notificationHandler.SuperadminIndex)
		guarded.Get("/admin/notifications/:id", notificationHandler.SuperadminGetOne)
		guarded.Post("/admin/notifications/broadcast", notificationHandler.SuperadminBroadcast)
		guarded.Delete("/admin/notifications/:id", notificationHandler.SuperadminDelete)
		guarded.Get("/admin/stores/search", notificationHandler.SearchStores)
		guarded.Get("/admin/users/search", notificationHandler.SearchUsers)
		guarded.Get("/stores/search", notificationHandler.SearchStores)
		guarded.Get("/users/search", notificationHandler.SearchUsers)

		// Store Activity Extension & Superadmin Dormancy Metrics
		guarded.Post("/stores/extend-activity", handlers.HandleExtendStoreActivity)
		guarded.Post("/store/extend-activity", handlers.HandleExtendStoreActivity)

		// System Bot & Automation Engine Monitoring & Sandbox
		guarded.Get("/admin/automation/status", notificationHandler.GetAutomationStatus)
		guarded.Get("/admin/automation/logs", notificationHandler.GetAutomationLogs)
		guarded.Post("/admin/automation/trigger", notificationHandler.TriggerAutomationBot)
		guarded.Get("/automation/status", notificationHandler.GetAutomationStatus)
		guarded.Get("/automation/logs", notificationHandler.GetAutomationLogs)
		guarded.Post("/automation/trigger", notificationHandler.TriggerAutomationBot)

		// Enterprise Activity & Audit Logs
		guarded.Get("/activity-logs", activityLogHandler.GetStoreActivityLogs)
		guarded.Get("/activity-logs/summary", activityLogHandler.GetActivitySummary)
		guarded.Get("/admin/audit-logs", activityLogHandler.GetSuperadminAuditLogs)
		guarded.Get("/superadmin/dormancy/metrics", handlers.HandleGetDormancyMetrics)

		// Market Intelligence & Macro Analytics
		guarded.Get("/admin/market-intelligence", analyticsHandler.GetMarketIntelligenceSummary)
		guarded.Get("/admin/market-intelligence/export", analyticsHandler.ExportMarketIntelligenceData)

		// Master Safe Domains
		guarded.Get("/admin/safe-domains", safeDomainHandler.GetAdminSafeDomains)
		guarded.Post("/admin/safe-domains", safeDomainHandler.CreateSafeDomain)
		guarded.Put("/admin/safe-domains/:id", safeDomainHandler.UpdateSafeDomain)
		guarded.Delete("/admin/safe-domains/:id", safeDomainHandler.DeleteSafeDomain)
		guarded.Post("/admin/safe-domains/reset-defaults", safeDomainHandler.ResetDefaultSafeDomains)
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

		// Compliance & Trust / Safety (Satwa & Laporan)
		adminApi.Get("/reports", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.Index)
		adminApi.Get("/reports/:id", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.Show)
		adminApi.Put("/reports/:id", middleware.RequirePermission(cfg, "compliance:reports:manage"), reportHandler.UpdateStatus)
		adminApi.Get("/dormancy/metrics", middleware.RequirePermission(cfg, "compliance:dormancy:manage"), handlers.HandleGetDormancyMetrics)
		adminApi.Get("/superadmin/dormancy/metrics", middleware.RequirePermission(cfg, "compliance:dormancy:manage"), handlers.HandleGetDormancyMetrics)

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

		// Monetization & Google Analytics Settings
		adminApi.Get("/settings", middleware.RequirePermission(cfg, "monetization:google:manage"), settingHandler.Index)
		adminApi.Post("/settings", middleware.RequirePermission(cfg, "monetization:google:manage"), settingHandler.Store)

		// Master Safe Domains (Ecosystem URL Whitelist)
		adminApi.Get("/safe-domains", safeDomainHandler.GetAdminSafeDomains)
		adminApi.Post("/safe-domains", safeDomainHandler.CreateSafeDomain)
		adminApi.Put("/safe-domains/:id", safeDomainHandler.UpdateSafeDomain)
		adminApi.Delete("/safe-domains/:id", safeDomainHandler.DeleteSafeDomain)
		adminApi.Post("/safe-domains/reset-defaults", safeDomainHandler.ResetDefaultSafeDomains)

		// Finance & Billing
		adminApi.Get("/subscription/orders", middleware.RequirePermission(cfg, "finance:orders:read"), subscriptionHandler.GetOrders)

		// Audit & Market Intelligence
		adminApi.Get("/audit-logs", middleware.RequirePermission(cfg, "audit:logs:read"), activityLogHandler.GetSuperadminAuditLogs)
		adminApi.Get("/market-intelligence", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.GetMarketIntelligenceSummary)
		adminApi.Get("/market-intelligence/export", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.ExportMarketIntelligenceData)

		// Master Safe Domains (RBAC Protected)
		adminApi.Get("/safe-domains", safeDomainHandler.GetAdminSafeDomains)
		adminApi.Post("/safe-domains", safeDomainHandler.CreateSafeDomain)
		adminApi.Put("/safe-domains/:id", safeDomainHandler.UpdateSafeDomain)
		adminApi.Delete("/safe-domains/:id", safeDomainHandler.DeleteSafeDomain)
		adminApi.Post("/safe-domains/reset-defaults", safeDomainHandler.ResetDefaultSafeDomains)
	}

	// 9. SPA Wildcard Fallback Router for Desktop & Mobile clients
	app.Get("/*", spaHandler.ServeSPA)

	// 10. Graceful Shutdown & Server Listen
	listenAddr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)

	go func() {
		if err := app.Listen(listenAddr); err != nil {
			log.Info().Err(err).Msg("Server shutting down")
		}
	}()

	log.Info().
		Str("address", fmt.Sprintf("http://localhost:%s", cfg.Port)).
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

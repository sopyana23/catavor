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

	// 3.1 Seed Default Subscription Plans
	if err := services.SeedSubscriptionPlans(database.DB); err != nil {
		log.Warn().Err(err).Msg("Failed to seed default subscription plans")
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
	storeHandler := handlers.NewStoreHandler()
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
	spaHandler := handlers.NewSPAHandler(cfg)

	// Start Background Notification Cleaner Worker (Purges expired and stale notifications every hour)
	services.StartNotificationCleaner(context.Background(), database.DB, 1*time.Hour)

	// Start Background Activity Log Retention Cleaner Worker (Runs daily)
	services.StartActivityLogCleaner(context.Background(), database.DB, 24*time.Hour)

	// Start Background Dormancy & Free Tier Lifecycle Worker (Runs on boot and every 1 hour)
	services.StartDormancyWorker(context.Background(), database.DB, storageService, 1*time.Hour)

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
	})
	app.Static("/mobile", cfg.MobileDistDir, fiber.Static{
		Compress:  true,
		ByteRange: true,
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
	}

	// Guarded Admin & Merchant Endpoints (Requires JWT Token & Store Ownership)
	guarded := api.Group("", middleware.AuthRequired(cfg), middleware.StoreOwnerRequired())
	{

		// Storage & Cloud Object Endpoints (S3 / MinIO / Local)
		guarded.Post("/storage/upload", storageHandler.Upload)
		guarded.Delete("/storage/file", storageHandler.DeleteFile)
		guarded.Post("/upload-image", storageHandler.Upload) // Backward compatibility alias

		// CRUD Modern Product & Category
		guarded.Post("/products", productHandler.Store)
		guarded.Put("/products/:id", productHandler.Update)
		guarded.Delete("/products/:id", productHandler.Destroy)

		guarded.Get("/admin/categories", categoryHandler.Index)
		guarded.Post("/categories", categoryHandler.Store)
		guarded.Put("/categories/:id", categoryHandler.Update)
		guarded.Delete("/categories/:id", categoryHandler.Destroy)

		// Support Tickets & Live Chat Conversations (with normalized attachments)
		guarded.Get("/support/tickets", supportHandler.ListMyTickets)
		guarded.Get("/support/tickets/:id", supportHandler.GetTicketDetails)
		guarded.Post("/support/tickets", supportHandler.CreateTicket)
		guarded.Post("/support/tickets/:id/reply", supportHandler.ReplyTicket)

		// Admin Support Moderation
		guarded.Get("/admin/support/tickets", supportHandler.ListAllTickets)
		guarded.Post("/admin/support/tickets/:id/reply", supportHandler.ReplyAsAdmin)
		guarded.Put("/admin/support/tickets/:id/status", supportHandler.UpdateTicketStatus)

		// CRUD Item Catalog (Legacy Aliases)
		guarded.Post("/fauna", productHandler.Store)
		guarded.Put("/fauna/:id", productHandler.Update)
		guarded.Delete("/fauna/:id", productHandler.Destroy)

		// Multi-Tenant Store Settings & Two-Tier Master Data
		guarded.Post("/stores/update", storeHandler.UpdateStore)
		guarded.Post("/stores/upgrade-plan", subscriptionHandler.UpgradePlan)
		guarded.Post("/stores/add-master-option", storeHandler.AddMasterOption)
		guarded.Post("/stores/rename-master-option", storeHandler.RenameMasterOption)
		guarded.Post("/stores/delete-master-option", storeHandler.DeleteMasterOption)
		guarded.Post("/stores/apply-master-preset", storeHandler.ApplyMasterPreset)

		// Multi-Tier Subscription, Quota & Custom Domain Management
		guarded.Get("/subscription/my-quota", subscriptionHandler.GetStoreQuota)
		guarded.Post("/subscription/upgrade", subscriptionHandler.UpgradePlan)
		guarded.Post("/subscription/schedule-downgrade", subscriptionHandler.ScheduleDowngrade)
		guarded.Post("/subscription/cancel-downgrade", subscriptionHandler.CancelDowngrade)
		guarded.Post("/subscription/custom-domain", subscriptionHandler.UpdateCustomDomain)
		guarded.Post("/subscription/order", subscriptionHandler.CreateOrder)
		guarded.Get("/subscription/orders", subscriptionHandler.GetOrders)

		// Merchant Analytics & Store Telemetry
		guarded.Get("/admin/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/analytics/products", analyticsHandler.GetStoreAnalyticsProducts)
		guarded.Get("/admin/analytics", analyticsHandler.GetStoreAnalytics)
		guarded.Get("/analytics", analyticsHandler.GetStoreAnalytics)

		// Settings & Policies
		guarded.Post("/settings", settingHandler.Store)
		guarded.Post("/settings/policies", settingHandler.UpdatePolicy)
		guarded.Get("/settings/policy-audit-logs", settingHandler.GetPolicyAuditLogs)

		// Articles & Moderation
		guarded.Post("/articles", articleHandler.Store)
		guarded.Put("/articles/:id", articleHandler.Update)
		guarded.Delete("/articles/:id", articleHandler.Destroy)
		guarded.Get("/admin/comments", articleHandler.GetAdminComments)
		guarded.Post("/admin/comments/:id/approve", articleHandler.ApproveComment)
		guarded.Delete("/admin/comments/:id", articleHandler.DeleteComment)

		// Reports & Compliance Moderation
		guarded.Get("/reports", reportHandler.Index)
		guarded.Get("/reports/:id", reportHandler.Show)
		guarded.Put("/reports/:id", reportHandler.UpdateStatus)

		// Dynamic Notifications & Real-Time SSE
		guarded.Get("/notifications", notificationHandler.GetNotifications)
		guarded.Post("/notifications/read-all", notificationHandler.MarkAllAsRead)
		guarded.Post("/notifications/:id/read", notificationHandler.MarkAsRead)
		guarded.Post("/notifications/:id/dismiss", notificationHandler.Dismiss)
		guarded.Get("/notifications/stream", notificationHandler.Stream)

		// Superadmin Broadcast Notifications (Backward Compatibility Alias)
		guarded.Get("/admin/notifications", notificationHandler.SuperadminIndex)
		guarded.Post("/admin/notifications/broadcast", notificationHandler.SuperadminBroadcast)
		guarded.Delete("/admin/notifications/:id", notificationHandler.SuperadminDelete)

		// Store Activity Extension & Superadmin Dormancy Metrics
		guarded.Post("/stores/extend-activity", handlers.HandleExtendStoreActivity)
		guarded.Post("/store/extend-activity", handlers.HandleExtendStoreActivity)

		// Enterprise Activity & Audit Logs
		guarded.Get("/activity-logs", activityLogHandler.GetStoreActivityLogs)
		guarded.Get("/activity-logs/summary", activityLogHandler.GetActivitySummary)
		guarded.Get("/admin/audit-logs", activityLogHandler.GetSuperadminAuditLogs)
		guarded.Get("/superadmin/dormancy/metrics", handlers.HandleGetDormancyMetrics)

		// Market Intelligence & Macro Analytics
		guarded.Get("/admin/market-intelligence", analyticsHandler.GetMarketIntelligenceSummary)
		guarded.Get("/admin/market-intelligence/export", analyticsHandler.ExportMarketIntelligenceData)
	}

	// 8.1 Dedicated Platform Admin API Group (Granular RBAC Protected)
	adminApi := api.Group("/admin", middleware.AuthRequired(cfg), middleware.RequireAdmin(cfg))
	{
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
		adminApi.Post("/support/tickets/:id/reply", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.ReplyAsAdmin)
		adminApi.Put("/support/tickets/:id/status", middleware.RequirePermission(cfg, "support:tickets:reply"), supportHandler.UpdateTicketStatus)

		// Content & Broadcast
		adminApi.Get("/notifications", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminIndex)
		adminApi.Post("/notifications/broadcast", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminBroadcast)
		adminApi.Delete("/notifications/:id", middleware.RequirePermission(cfg, "content:broadcast:send"), notificationHandler.SuperadminDelete)

		// Monetization & Google Analytics Settings
		adminApi.Get("/settings", middleware.RequirePermission(cfg, "monetization:google:manage"), settingHandler.Index)
		adminApi.Post("/settings", middleware.RequirePermission(cfg, "monetization:google:manage"), settingHandler.Store)

		// Finance & Billing
		adminApi.Get("/subscription/orders", middleware.RequirePermission(cfg, "finance:orders:read"), subscriptionHandler.GetOrders)

		// Audit & Market Intelligence
		adminApi.Get("/audit-logs", middleware.RequirePermission(cfg, "audit:logs:read"), activityLogHandler.GetSuperadminAuditLogs)
		adminApi.Get("/market-intelligence", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.GetMarketIntelligenceSummary)
		adminApi.Get("/market-intelligence/export", middleware.RequirePermission(cfg, "market_intel:manage"), analyticsHandler.ExportMarketIntelligenceData)
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

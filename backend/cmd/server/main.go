package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/handlers"
	"catavor-backend/internal/middleware"

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

	// 4. Initialize Fiber App with Industrial SaaS timeouts
	app := fiber.New(fiber.Config{
		AppName:               "Catavor Multi-Channel Commerce Server",
		BodyLimit:             12 * 1024 * 1024, // 12 MB max payload
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          15 * time.Second,
		IdleTimeout:           120 * time.Second,
		DisableStartupMessage: false,
	})

	// 5. Setup Security Middlewares (CORS, Headers, Recovery, Tracing, Logger)
	middleware.SetupSecurityMiddlewares(app, cfg)

	// 6. Setup Handlers
	authHandler := handlers.NewAuthHandler(cfg)
	storeHandler := handlers.NewStoreHandler()
	faunaHandler := handlers.NewFaunaHandler(cfg)
	articleHandler := handlers.NewArticleHandler()
	settingHandler := handlers.NewSettingHandler()
	spaHandler := handlers.NewSPAHandler(cfg)

	// 7. Static Asset Directories
	app.Static("/storage", cfg.StorageDir, fiber.Static{
		Compress:  true,
		ByteRange: true,
		MaxAge:    86400 * 7,
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
	api := app.Group("/api")

	// Public Endpoints
	api.Get("/fauna", faunaHandler.Index)
	api.Get("/fauna/:id", faunaHandler.Show)
	api.Get("/taxonomy/culinary", faunaHandler.GetCulinaryTaxonomy)
	api.Get("/settings", settingHandler.Index)
	api.Get("/policies", settingHandler.GetPolicies)
	api.Post("/policies/agree", settingHandler.RecordAgreement)
	api.Get("/articles", articleHandler.Index)
	api.Get("/articles/:id", articleHandler.Show)
	api.Get("/articles/:id/comments", articleHandler.GetArticleComments)
	api.Post("/articles/:id/comments", articleHandler.StoreComment)
	api.Post("/sightings", settingHandler.StoreSighting)

	// Multi-Tenant Public Store Endpoints
	api.Get("/stores/featured", storeHandler.FeaturedStores)
	api.Get("/check-slug/:slug", storeHandler.CheckSlug)
	api.Get("/u/:slug", storeHandler.ShowStore)
	api.Get("/u/:slug/fauna", storeHandler.IndexFauna)

	// Authentication Endpoints with Rate Limiter
	api.Post("/login", middleware.AuthRateLimiter(), authHandler.Login)
	api.Post("/register", middleware.AuthRateLimiter(), authHandler.Register)
	api.Post("/auth/google", middleware.AuthRateLimiter(), authHandler.GoogleAuth)

	// Guarded Admin Endpoints (Requires JWT Token & Store Ownership)
	guarded := api.Group("", middleware.AuthRequired(cfg), middleware.StoreOwnerRequired())
	{
		guarded.Post("/logout", authHandler.Logout)
		guarded.Post("/profile", authHandler.UpdateProfile)

		// CRUD Item Catalog & Images
		guarded.Post("/upload-image", faunaHandler.UploadImage)
		guarded.Post("/fauna", faunaHandler.Store)
		guarded.Put("/fauna/:id", faunaHandler.Update)
		guarded.Delete("/fauna/:id", faunaHandler.Destroy)

		// Multi-Tenant Store Settings & Two-Tier Master Data
		guarded.Post("/stores/update", storeHandler.UpdateStore)
		guarded.Post("/stores/upgrade-plan", storeHandler.UpgradePlan)
		guarded.Post("/stores/add-master-option", storeHandler.AddMasterOption)
		guarded.Post("/stores/rename-master-option", storeHandler.RenameMasterOption)
		guarded.Post("/stores/delete-master-option", storeHandler.DeleteMasterOption)
		guarded.Post("/stores/apply-master-preset", storeHandler.ApplyMasterPreset)

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

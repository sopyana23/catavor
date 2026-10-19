// Command seed-e2e menyiapkan fixture deterministik untuk suite E2E
// (tests/e2e/*.spec.ts). Idempoten: aman dijalankan berulang kali.
//
// Yang dibuat:
//  1. Store publik "adidas" (tanpa owner khusus) — dipakai spec
//     device-sanity & history-back. Item katalognya diisi oleh
//     `go run ./cmd/seed_adidas`.
//  2. Merchant "e2e-admin@catavor.test" + store "e2e-store" miliknya —
//     dipakai spec session-from-token & task-31-idle-resync.
//
// Pemakaian:
//
//	cd backend && go run ./cmd/seed-e2e && go run ./cmd/seed_adidas
//
// Kredensial uji (sengaja bukan rahasia, hanya untuk DB lokal/CI):
//
//	CATAVOR_ADMIN_EMAIL=e2e-admin@catavor.test
//	CATAVOR_ADMIN_PASSWORD=E2eTest!2026
package main

import (
	"fmt"
	"os"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	e2eEmail    = "e2e-admin@catavor.test"
	e2ePassword = "E2eTest!2026"
	e2eSlug     = "e2e-store"

	publicSlug  = "adidas"
	publicTitle = "Adidas"
)

func main() {
	cfg := config.LoadConfig()
	db, err := gorm.Open(postgres.Open(cfg.GetPostgresDSN()), &gorm.Config{})
	if err != nil {
		fail("koneksi DB gagal: %v", err)
	}

	// Owner teknis untuk store publik fixture (bukan akun login).
	ownerID := ensureUser(db, "fixture-owner@catavor.test", "Fixture Owner", "FixtureOwner!"+e2ePassword)

	ensureStore(db, ownerID, publicSlug, publicTitle)

	merchantID := ensureUser(db, e2eEmail, "E2E Admin", e2ePassword)
	// Store kredensial dimiliki merchant uji, bukan fixture owner.
	ensureStore(db, merchantID, e2eSlug, "E2E Store")

	fmt.Println()
	fmt.Println("Fixture E2E siap.")
	fmt.Printf("  email    : %s\n", e2eEmail)
	fmt.Printf("  password : %s\n", e2ePassword)
	fmt.Printf("  slug     : %s\n", e2eSlug)
	fmt.Println("Langkah berikutnya: go run ./cmd/seed_adidas  (isi katalog store \"adidas\")")
}

func ensureUser(db *gorm.DB, email, name, password string) uint {
	var u models.User
	err := db.Where("email = ?", email).First(&u).Error
	if err == nil {
		if err := u.SetPassword(password); err != nil {
			fail("hash password %s: %v", email, err)
		}
		db.Model(&u).Updates(map[string]any{
			"password":       u.Password,
			"is_blacklisted": false,
			"token_version":  gorm.Expr("token_version + 1"),
		})
		fmt.Printf("user    ok (existing) id=%d %s\n", u.ID, email)
		return u.ID
	}
	if err != gorm.ErrRecordNotFound {
		fail("cari user %s: %v", email, err)
	}

	now := time.Now()
	u = models.User{
		Name:            name,
		Email:           email,
		EmailVerifiedAt: &now,
		PlatformRole:    "merchant",
		TokenVersion:    1,
	}
	if err := u.SetPassword(password); err != nil {
		fail("hash password %s: %v", email, err)
	}
	if err := db.Create(&u).Error; err != nil {
		fail("buat user %s: %v", email, err)
	}
	fmt.Printf("user    + id=%d %s\n", u.ID, email)
	return u.ID
}

func ensureStore(db *gorm.DB, userID uint, slug, title string) {
	var s models.Store
	err := db.Where("slug = ?", slug).First(&s).Error
	if err == nil {
		db.Model(&s).Updates(map[string]any{
			"user_id":        userID,
			"is_suspended":   false,
			"is_blacklisted": false,
			"plan_status":    "active",
		})
		fmt.Printf("store   ok (existing) id=%d slug=%s\n", s.ID, s.Slug)
		return
	}
	if err != gorm.ErrRecordNotFound {
		fail("cari store %s: %v", slug, err)
	}

	s = models.Store{
		UserID:        userID,
		Slug:          slug,
		StoreTitle:    title,
		Plan:          "free",
		PaymentStatus: "free_active",
		PlanStatus:    "active",
	}
	if err := db.Create(&s).Error; err != nil {
		fail("buat store %s: %v", slug, err)
	}
	fmt.Printf("store   + id=%d slug=%s\n", s.ID, s.Slug)
}

func fail(format string, args ...any) {
	fmt.Printf("ERROR: "+format+"\n", args...)
	os.Exit(1)
}

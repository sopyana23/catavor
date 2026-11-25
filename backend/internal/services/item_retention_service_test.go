package services

import (
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestProcessItemRetentionCycle_PurgeBannedStorePreservesReportsWithoutFKError(t *testing.T) {
	dsn := "file:TestProcessItemRetentionCycle_PurgeBannedStore?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}

	if err := db.Exec("PRAGMA foreign_keys = ON;").Error; err != nil {
		t.Fatalf("enable pragma foreign_keys: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.ProductVariant{},
		&models.Report{},
	); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	oldTime := time.Now().UTC().AddDate(0, 0, -95)
	owner := models.User{Name: "Banned Owner", Email: "banned-owner-ret@example.invalid"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	store := models.Store{
		UserID:           owner.ID,
		Slug:             "qa-ret-banned-store",
		StoreTitle:       "QA Retention Banned Store",
		DormancyStatus:   "banned",
		IsSuspended:      true,
		IsBlacklisted:    true,
		DormancyBannedAt: &oldTime,
	}
	if err := db.Create(&store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	// Also test H-90 item retention nullifies both product_id and fauna_id without FK errors,
	// and banned store purge (with product ModeratedAt == nil so it runs via BannedStoresPurged).
	prod := models.Product{
		StoreID:          store.ID,
		Name:             "Produk Terlarang Banned",
		ProductType:      "physical",
		Price:            100000,
		IsActive:         false,
		ModerationStatus: "banned",
	}
	if err := db.Create(&prod).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	// Historical resolved/banned report still referencing BOTH product_id and fauna_id
	histReport := models.Report{
		ReportNumber:   "RPT-20260101-RET01",
		TargetType:     "item",
		StoreID:        store.ID,
		ProductID:      &prod.ID,
		FaunaID:        &prod.ID,
		StoreSlug:      store.Slug,
		StoreTitle:     store.StoreTitle,
		ItemName:       prod.Name,
		ItemType:       "physical",
		ReasonCategory: "illegal",
		ReasonLabel:    "Pelanggaran Berat",
		Status:         "banned",
		ActionTaken:    "item_banned",
	}
	if err := db.Create(&histReport).Error; err != nil {
		t.Fatalf("create report: %v", err)
	}

	stats, cycleErr := ProcessItemRetentionCycle(db, nil)
	if cycleErr != nil {
		t.Fatalf("ProcessItemRetentionCycle failed: %v", cycleErr)
	}
	if stats.BannedStoresPurged != 1 {
		t.Fatalf("expected BannedStoresPurged=1, got %+v", stats)
	}

	var prodCount int64
	db.Unscoped().Model(&models.Product{}).Where("id = ?", prod.ID).Count(&prodCount)
	if prodCount != 0 {
		t.Fatalf("expected purged product removed, count=%d", prodCount)
	}

	var updatedStore models.Store
	if err := db.First(&updatedStore, store.ID).Error; err != nil {
		t.Fatalf("load purged store: %v", err)
	}
	if updatedStore.DormancyStatus != "purged" {
		t.Fatalf("expected dormancy_status='purged', got %q", updatedStore.DormancyStatus)
	}

	var preservedReport models.Report
	if err := db.First(&preservedReport, histReport.ID).Error; err != nil {
		t.Fatalf("expected historical report preserved, err=%v", err)
	}
	if preservedReport.ProductID != nil || preservedReport.FaunaID != nil {
		t.Fatalf("expected product_id & fauna_id nullified on purge, got pid=%v fid=%v",
			preservedReport.ProductID, preservedReport.FaunaID)
	}
	if preservedReport.ItemName != prod.Name {
		t.Fatalf("expected item_name snapshot preserved, got %q", preservedReport.ItemName)
	}
}

package main

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openCLITestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.UserSession{},
		&models.ActivityLog{},
		&models.TwoFactorRecoveryTicket{},
		&models.MFAAccountLockout{},
		&models.MFAChallengeFailure{},
	); err != nil {
		t.Fatalf("automigrate sqlite: %v", err)
	}
	return db
}

func TestProvisionSuperadminViaStdinAndCheckGoLive(t *testing.T) {
	db := openCLITestDB(t)
	noSchemaIssues := func(*gorm.DB) ([]string, error) { return nil, nil }

	var out, errBuf bytes.Buffer
	// NIST SP 800-63B: passphrase dengan spasi wajib dipertahankan utuh (hanya strip \r\n).
	pass1 := "Correct Horse Battery! 2026"
	code := runAdminCLI(db, cliOptions{
		Email:         "ops1@catavor.com",
		Name:          "Primary Ops Admin",
		PasswordStdin: true,
	}, strings.NewReader(pass1+"\r\n"), &out, &errBuf)
	if code != 0 {
		t.Fatalf("provision superadmin #1 failed (code=%d): %s", code, errBuf.String())
	}

	var u1 models.User
	if err := db.Where("email = ?", "ops1@catavor.com").First(&u1).Error; err != nil {
		t.Fatalf("load u1: %v", err)
	}
	if u1.PlatformRole != "superadmin" || !u1.TwoFactorEnforced || u1.TwoFactorEnabled {
		t.Fatalf("unexpected u1 state: role=%s enforced=%v enabled=%v", u1.PlatformRole, u1.TwoFactorEnforced, u1.TwoFactorEnabled)
	}
	if !u1.CheckPassword(pass1) {
		t.Fatal("passphrase with spaces was mangled instead of preserved")
	}

	// Hanya 1 Superadmin -> check-go-live WAJIB gagal (kuorum Dual-Control minimal 2).
	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		CheckGoLive:    true,
		VerifySchemaFn: noSchemaIssues,
	}, nil, &out, &errBuf)
	if code == 0 {
		t.Fatal("expected check-go-live to fail with only 1 superadmin")
	}

	// Buat Superadmin kedua -> check-go-live pra-onboarding lulus, tetapi -require-mfa-enrolled masih gagal.
	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		Email:         "ops2@catavor.com",
		Name:          "Secondary Ops Admin",
		PasswordStdin: true,
	}, strings.NewReader("SecondAdminStrong!2026\n"), &out, &errBuf)
	if code != 0 {
		t.Fatalf("provision superadmin #2 failed: %s", errBuf.String())
	}

	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		CheckGoLive:    true,
		VerifySchemaFn: noSchemaIssues,
	}, nil, &out, &errBuf)
	if code != 0 {
		t.Fatalf("expected pre-enrollment check-go-live to pass with 2 superadmins, got stderr: %s", errBuf.String())
	}

	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		CheckGoLive:        true,
		RequireMFAEnrolled: true,
		VerifySchemaFn:     noSchemaIssues,
	}, nil, &out, &errBuf)
	if code == 0 {
		t.Fatal("expected -require-mfa-enrolled to fail before TOTP enrollment")
	}

	// Simulasikan kedua Superadmin telah menyelesaikan aktivasi TOTP MFA.
	enc := "v1:encrypted-totp-secret"
	if err := db.Model(&models.User{}).Where("platform_role = ?", "superadmin").Updates(map[string]interface{}{
		"two_factor_enabled":    true,
		"two_factor_secret_enc": &enc,
	}).Error; err != nil {
		t.Fatalf("update enrolled mfa: %v", err)
	}

	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		CheckGoLive:        true,
		RequireMFAEnrolled: true,
		VerifySchemaFn:     noSchemaIssues,
	}, nil, &out, &errBuf)
	if code != 0 {
		t.Fatalf("expected -require-mfa-enrolled to pass once 2 superadmins enrolled MFA: %s", errBuf.String())
	}
}

func TestProvisionRejectsMerchantWithStoreAndRevokesSessionsOnStaffPromotion(t *testing.T) {
	db := openCLITestDB(t)

	merchant := models.User{
		Name:         "Merchant Owner",
		Email:        "owner@toko.id",
		Password:     "x",
		PlatformRole: "merchant",
	}
	if err := db.Create(&merchant).Error; err != nil {
		t.Fatalf("create merchant: %v", err)
	}
	store := models.Store{
		UserID:         merchant.ID,
		Slug:           "toko-owner",
		StoreTitle:     "Toko Owner",
		WhatsappNumber: "08123456789",
	}
	if err := db.Create(&store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	var out, errBuf bytes.Buffer
	code := runAdminCLI(db, cliOptions{
		Email:         merchant.Email,
		PasswordStdin: true,
	}, strings.NewReader("SuperStrongPass!2026\n"), &out, &errBuf)
	if code == 0 {
		t.Fatal("expected promoting merchant store owner to superadmin to be rejected")
	}

	// Akun staf support tanpa toko dapat ditingkatkan menjadi superadmin, dan sesi lamanya wajib dicabut.
	staff := models.User{
		Name:              "Support Staff",
		Email:             "support@catavor.com",
		Password:          "x",
		PlatformRole:      "support",
		TwoFactorEnforced: true,
		TokenVersion:      2,
	}
	if err := db.Create(&staff).Error; err != nil {
		t.Fatalf("create staff: %v", err)
	}
	now := time.Now().UTC()
	sess := models.UserSession{
		UserID:       staff.ID,
		TokenID:      "jti-old-staff-session",
		IPAddress:    "127.0.0.1",
		DeviceName:   "Chrome",
		DeviceType:   "desktop",
		LastActiveAt: now,
		ExpiresAt:    now.Add(12 * time.Hour),
		IsRevoked:    false,
	}
	if err := db.Create(&sess).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}

	out.Reset()
	errBuf.Reset()
	code = runAdminCLI(db, cliOptions{
		Email:         staff.Email,
		PasswordStdin: true,
	}, strings.NewReader("PromotedAdmin!2026\n"), &out, &errBuf)
	if code != 0 {
		t.Fatalf("promote staff failed: %s", errBuf.String())
	}

	var updatedStaff models.User
	db.First(&updatedStaff, staff.ID)
	if updatedStaff.PlatformRole != "superadmin" || !updatedStaff.TwoFactorEnforced || updatedStaff.TokenVersion <= 2 {
		t.Fatalf("unexpected promoted staff state: %+v", updatedStaff)
	}
	var updatedSess models.UserSession
	db.First(&updatedSess, sess.ID)
	if !updatedSess.IsRevoked {
		t.Fatal("expected old staff session to be revoked on superadmin promotion")
	}
}

func TestBreakGlassMFAResetDualControlAndAuditTrail(t *testing.T) {
	db := openCLITestDB(t)
	now := time.Now().UTC()
	secret := "v1:cipher"
	backups := `["hash1","hash2"]`

	adminA := models.User{
		Name:                     "Admin Locked",
		Email:                    "admin-a@catavor.com",
		Password:                 "x",
		PlatformRole:             "superadmin",
		TwoFactorEnabled:         true,
		TwoFactorEnforced:        true,
		TwoFactorSecretEnc:       &secret,
		TwoFactorBackupCodesHash: &backups,
		TwoFactorEnrolledAt:      &now,
		TwoFactorLastTOTPStep:    999,
		TokenVersion:             4,
	}
	adminB := models.User{
		Name:               "Admin Approver",
		Email:              "admin-b@catavor.com",
		Password:           "x",
		PlatformRole:       "superadmin",
		TwoFactorEnabled:   true,
		TwoFactorEnforced:  true,
		TwoFactorSecretEnc: &secret,
		TokenVersion:       1,
	}
	if err := db.Create(&adminA).Error; err != nil {
		t.Fatalf("create adminA: %v", err)
	}
	if err := db.Create(&adminB).Error; err != nil {
		t.Fatalf("create adminB: %v", err)
	}

	lockedUntil := now.Add(30 * time.Minute)
	db.Create(&models.MFAAccountLockout{
		UserID:          adminA.ID,
		FailedAttempts:  8,
		WindowStartedAt: now,
		LockedUntil:     &lockedUntil,
		UpdatedAt:       now,
	})
	db.Create(&models.UserSession{
		UserID:       adminA.ID,
		TokenID:      "jti-admin-a-active",
		IPAddress:    "127.0.0.1",
		DeviceName:   "Firefox",
		DeviceType:   "desktop",
		LastActiveAt: now,
		ExpiresAt:    now.Add(6 * time.Hour),
		IsRevoked:    false,
	})

	var out, errBuf bytes.Buffer
	// 1. Self-approval WAJIB ditolak.
	if code := runAdminCLI(db, cliOptions{
		ResetMFA:   true,
		Email:      adminA.Email,
		TicketID:   "INC-2026-101",
		ApprovedBy: adminA.Email,
	}, nil, &out, &errBuf); code == 0 {
		t.Fatal("self-approval must be rejected")
	}

	// 2. Emergency single-admin override WAJIB ditolak saat >= 2 Superadmin ber-MFA aktif tersedia.
	out.Reset()
	errBuf.Reset()
	if code := runAdminCLI(db, cliOptions{
		ResetMFA:                     true,
		Email:                        adminA.Email,
		TicketID:                     "INC-2026-102",
		EmergencySingleAdminOverride: true,
	}, nil, &out, &errBuf); code == 0 {
		t.Fatal("single-admin override must be rejected when 2 enrolled superadmins exist")
	}

	// 3. Dual-Control sah (adminB menyetujui pemulihan adminA) -> sukses, lockout hilang, sesi dicabut, TwoFactorEnforced tetap true!
	out.Reset()
	errBuf.Reset()
	if code := runAdminCLI(db, cliOptions{
		ResetMFA:   true,
		Email:      adminA.Email,
		TicketID:   "INC-2026-103",
		ApprovedBy: adminB.Email,
	}, nil, &out, &errBuf); code != 0 {
		t.Fatalf("dual-control break-glass reset failed: %s", errBuf.String())
	}

	var refreshed models.User
	if err := db.First(&refreshed, adminA.ID).Error; err != nil {
		t.Fatalf("reload adminA: %v", err)
	}
	if refreshed.TwoFactorEnabled || !refreshed.TwoFactorEnforced {
		t.Fatalf("expected TwoFactorEnabled=false and TwoFactorEnforced=true, got enabled=%v enforced=%v",
			refreshed.TwoFactorEnabled, refreshed.TwoFactorEnforced)
	}
	if refreshed.TwoFactorSecretEnc != nil || refreshed.TwoFactorBackupCodesHash != nil || refreshed.TwoFactorLastTOTPStep != 0 {
		t.Fatalf("expected MFA secrets and step cleared, got %+v", refreshed)
	}
	if refreshed.TokenVersion <= 4 {
		t.Fatalf("expected TokenVersion incremented (>4), got %d", refreshed.TokenVersion)
	}

	var lockCount int64
	db.Model(&models.MFAAccountLockout{}).Where("user_id = ?", adminA.ID).Count(&lockCount)
	if lockCount != 0 {
		t.Fatalf("expected MFA lockout cleared, got %d", lockCount)
	}

	var activeSessions int64
	db.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = ?", adminA.ID, false).Count(&activeSessions)
	if activeSessions != 0 {
		t.Fatalf("expected all active sessions revoked, got %d", activeSessions)
	}

	var tickets []models.TwoFactorRecoveryTicket
	db.Where("user_id = ?", adminA.ID).Find(&tickets)
	if len(tickets) != 1 || tickets[0].State != "EXECUTED" || tickets[0].Approver1StaffID == nil || *tickets[0].Approver1StaffID != adminB.ID {
		t.Fatalf("unexpected recovery ticket ledger: %+v", tickets)
	}

	var logs []models.ActivityLog
	db.Where("action = ?", "SECURITY_BREAK_GLASS_MFA_RESET").Find(&logs)
	if len(logs) != 1 || !strings.Contains(logs[0].Description, "INC-2026-103") {
		t.Fatalf("expected immutable SECURITY_BREAK_GLASS_MFA_RESET audit log, got %+v", logs)
	}
}

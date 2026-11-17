package models

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestMFAModelAutoMigrateConstraintsAndSensitiveJSON(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:mfa_models_"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &UserSession{}, &TwoFactorRecoveryTicket{}, &MFAAuthCompletion{}, &MFAAccountLockout{}, &MFAChallengeFailure{}); err != nil {
		t.Fatalf("AutoMigrate MFA models: %v", err)
	}
	if !db.Migrator().HasTable("two_factor_recovery_tickets") || !db.Migrator().HasTable("mfa_auth_completions") || !db.Migrator().HasTable("mfa_account_lockouts") || !db.Migrator().HasTable("mfa_challenge_failures") {
		t.Fatal("MFA model table missing after AutoMigrate")
	}

	secret := "encrypted-secret-placeholder"
	user := User{Name: "MFA Test", Email: "mfa-model-test@example.test", Password: "hash", TwoFactorEnabled: true, TwoFactorSecretEnc: &secret}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	session := UserSession{UserID: user.ID, TokenID: "session-jti", IPAddress: "127.0.0.1", DeviceName: "test", DeviceType: "desktop", LastActiveAt: time.Now(), ExpiresAt: time.Now().Add(time.Hour)}
	if err := db.Create(&session).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}
	completion := MFAAuthCompletion{Purpose: "login", TokenJTI: "challenge-jti", UserID: user.ID, FactorType: "totp", SessionID: session.ID, PayloadEnc: "ciphertext", Status: "pending_redis", CreatedAt: time.Now(), UpdatedAt: time.Now(), ExpiresAt: time.Now().Add(time.Minute)}
	if err := db.Create(&completion).Error; err != nil {
		t.Fatalf("create MFA completion: %v", err)
	}
	duplicate := completion
	duplicate.ID = 0
	if err := db.Create(&duplicate).Error; err == nil {
		t.Fatal("duplicate (purpose, token_jti) must be rejected")
	}
	invalidFactor := completion
	invalidFactor.ID = 0
	invalidFactor.TokenJTI = "invalid-factor"
	invalidFactor.FactorType = "password"
	if err := db.Create(&invalidFactor).Error; err == nil {
		t.Fatal("invalid factor type must be rejected")
	}

	encoded, err := json.Marshal(struct {
		User       User
		Completion MFAAuthCompletion
	}{user, completion})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), secret) || strings.Contains(string(encoded), "ciphertext") {
		t.Fatal("sensitive MFA fields leaked through JSON")
	}
}

func TestMFAModelLockoutAndFailureConstraints(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:mfa_constraints_"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &MFAAccountLockout{}, &MFAChallengeFailure{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	user := User{Name: "MFA Test", Email: "mfa-constraints@example.test", Password: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	lockout := MFAAccountLockout{UserID: user.ID, WindowStartedAt: now, UpdatedAt: now}
	if err := db.Create(&lockout).Error; err != nil {
		t.Fatalf("create lockout: %v", err)
	}
	failure := MFAChallengeFailure{TokenJTI: "jti", LeaseGeneration: 1, UserID: user.ID, CreatedAt: now}
	if err := db.Create(&failure).Error; err != nil {
		t.Fatalf("create failure: %v", err)
	}
	if err := db.Create(&failure).Error; err == nil {
		t.Fatal("duplicate challenge generation must be rejected")
	}
	invalid := MFAChallengeFailure{TokenJTI: "bad", LeaseGeneration: 0, UserID: user.ID, CreatedAt: now}
	if err := db.Create(&invalid).Error; err == nil {
		t.Fatal("non-positive lease generation must be rejected")
	}
	negative := MFAAccountLockout{UserID: user.ID + 100, FailedAttempts: -1, WindowStartedAt: now, UpdatedAt: now}
	if err := db.Create(&negative).Error; err == nil {
		t.Fatal("negative failed attempt count must be rejected")
	}
}

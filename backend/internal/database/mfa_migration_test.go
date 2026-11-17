package database

import (
	"testing"

	"catavor-backend/internal/models"
)

func TestN60MigrationOnDisposablePostgres(t *testing.T) {
	db := migTestDB(t)
	if err := db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;").Error; err != nil {
		t.Fatalf("reset disposable schema: %v", err)
	}
	for _, stmt := range []string{
		`CREATE TABLE users (id BIGSERIAL PRIMARY KEY, platform_role VARCHAR(50) DEFAULT 'merchant')`,
		`CREATE TABLE user_sessions (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL)`,
	} {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("prepare N-60 prerequisite: %v", err)
		}
	}
	files, err := loadMigrations()
	if err != nil {
		t.Fatalf("load migrations: %v", err)
	}
	var n60 migrationFile
	for _, f := range files {
		if f.version == "20261116_n60_user_two_factor_auth.sql" {
			n60 = f
			break
		}
	}
	if n60.version == "" {
		t.Fatal("embedded N-60 migration not found")
	}
	if err := runMigrations(db, []migrationFile{n60}); err != nil {
		t.Fatalf("apply embedded N-60 to disposable PostgreSQL: %v", err)
	}
	for _, table := range []string{"two_factor_recovery_tickets", "mfa_auth_completions", "mfa_account_lockouts", "mfa_challenge_failures"} {
		if !db.Migrator().HasTable(table) {
			t.Errorf("N-60 table missing: %s", table)
		}
	}
	for _, col := range []string{"two_factor_enabled", "two_factor_enforced", "two_factor_secret_enc", "two_factor_backup_codes_hash", "two_factor_enrolled_at", "two_factor_setup_jti", "two_factor_last_totp_step"} {
		if !db.Migrator().HasColumn(&models.User{}, col) {
			t.Errorf("N-60 user column missing: %s", col)
		}
	}
	var before int64
	if err := db.Model(&schemaMigration{}).Where("version = ?", "20261116_n60_user_two_factor_auth.sql").Count(&before).Error; err != nil || before != 1 {
		t.Fatalf("N-60 ledger record count=%d err=%v", before, err)
	}
	if err := runMigrations(db, []migrationFile{n60}); err != nil {
		t.Fatalf("rerun embedded migrations: %v", err)
	}
	var after int64
	if err := db.Model(&schemaMigration{}).Where("version = ?", "20261116_n60_user_two_factor_auth.sql").Count(&after).Error; err != nil || after != 1 {
		t.Fatalf("N-60 ledger record after rerun=%d err=%v", after, err)
	}
}

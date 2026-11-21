package handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/mfa"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openDisposablePostgres(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("CATAVOR_PGTEST_DSN"))
	if dsn == "" {
		dsn = strings.TrimSpace(os.Getenv("CATAVOR_MIGTEST_DSN"))
	}
	if dsn == "" {
		t.Skip("CATAVOR_PGTEST_DSN / CATAVOR_MIGTEST_DSN tidak diset; lewati tes PostgreSQL disposable")
	}

	pgDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("koneksi PostgreSQL disposable gagal: %v", err)
	}

	var currentDB string
	if err := pgDB.Raw("SELECT current_database()").Scan(&currentDB).Error; err != nil {
		t.Fatalf("SELECT current_database(): %v", err)
	}
	lowerDB := strings.ToLower(strings.TrimSpace(currentDB))
	if lowerDB == "" || lowerDB == "catavor" || lowerDB == "postgres" ||
		(!strings.Contains(lowerDB, "test") && !strings.Contains(lowerDB, "disp")) {
		t.Fatalf("SAFETY GUARD: menolak menjalankan tes destruktif pada database %q (wajib DB disposable bernama *test* atau *disp*)", currentDB)
	}

	sqlDB, err := pgDB.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(16)
		sqlDB.SetMaxIdleConns(8)
		t.Cleanup(func() { _ = sqlDB.Close() })
	}

	if err := pgDB.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;").Error; err != nil {
		t.Fatalf("reset schema PostgreSQL disposable: %v", err)
	}

	// Seluruh skema wajib berasal dari jalur produksi: BootstrapProductionSchema
	// menjalankan AutoMigrate gelombang demi gelombang, lalu RunMigrations dan
	// verifikasi N-60 di dalamnya. Sebelumnya test menyusun AutoMigrate sebagian
	// model sendiri, sehingga tabel dari migrasi terbaru (mis. n62
	// pending_owner_media_deletions) tidak ada dan DeleteAccount gagal dengan
	// SQLSTATE 42P01 — kegagalan murni artefak test, bukan regresi kode.
	if err := database.BootstrapProductionSchema(pgDB); err != nil {
		t.Fatalf("BootstrapProductionSchema di PostgreSQL disposable: %v", err)
	}

	// Terapkan berkas migrasi N-60 asli agar seluruh CHECK constraint, UNIQUE index,
	// dan FOREIGN KEY PostgreSQL teruji persis seperti skema produksi.
	n60Path := filepath.Join("..", "database", "migrations", "20261116_n60_user_two_factor_auth.sql")
	rawSQL, err := os.ReadFile(n60Path)
	if err != nil {
		t.Fatalf("baca migrasi N-60 (%s): %v", n60Path, err)
	}
	if err := pgDB.Exec(string(rawSQL)).Error; err != nil {
		t.Fatalf("eksekusi migrasi N-60 di PostgreSQL disposable: %v", err)
	}

	database.DB = pgDB
	t.Cleanup(func() { database.DB = nil })
	return pgDB
}

// TestMFAPostgresConcurrencyRollbackAndSingleUse menguji properti transaksional
// PostgreSQL 17 yang tidak dapat disimulasikan penuh oleh SQLite in-memory:
//  1. Dua+ goroutine menukarkan challenge JTI yang SAMA secara bersamaan -> tepat 1 menang.
//  2. Goroutine paralel pada challenge BERBEDA namun kode TOTP / backup code SAMA -> tepat 1 menang.
//  3. Race paralel pada ConfirmEnrollment -> paling banyak 1 menang, hanya 1 sesi terbit.
//  4. Kegagalan DB (trigger gagal pada user_sessions) membatalkan (ROLLBACK) konsumsi TOTP & backup code,
//     tidak menyisakan baris completion, dan tidak mengeluarkan token/cookie; retry sukses setelah DB pulih.
//  5. Brute-force paralel lintas JTI segar terkunci dengan rapi tanpa lost-update.
//  6. Kolom mfa_auth_completions.payload_enc menyimpan ciphertext AEAD tanpa bearer plaintext.
func TestMFAPostgresConcurrencyRollbackAndSingleUse(t *testing.T) {
	pgDB := openDisposablePostgres(t)
	cfg := testCfg()
	app, _, _ := newFullMFARoutingApp(t, pgDB, cfg)

	// --- Subtes 1: Penukaran paralel JTI yang SAMA dengan 8 backup code sah berbeda ---
	t.Run("parallel_same_challenge_jti_allows_at_most_one_session", func(t *testing.T) {
		staff := models.User{
			Name:         "PG Concurrent Staff",
			Email:        "pg-jti-race@catavor.test",
			PlatformRole: "superadmin",
			TokenVersion: 1,
		}
		if err := staff.SetPassword("PostgresKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}

		secret, _ := security.GenerateTOTPSecret()
		sealed, _ := security.SealMFASecret(cfg.MFAEncryptionKey, secret)
		codes, hashes, err := security.GenerateBackupCodes(cfg.MFAEncryptionKey, 10)
		if err != nil {
			t.Fatal(err)
		}
		encHashes, _ := mfa.EncodeBackupCodeHashes(hashes)
		now := time.Now().UTC()
		if err := pgDB.Model(&models.User{}).Where("id = ?", staff.ID).Updates(map[string]interface{}{
			"two_factor_enabled":           true,
			"two_factor_enforced":          true,
			"two_factor_secret_enc":        sealed,
			"two_factor_backup_codes_hash": encHashes,
			"two_factor_enrolled_at":       now,
		}).Error; err != nil {
			t.Fatal(err)
		}

		stLogin, loginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email":    staff.Email,
			"password": "PostgresKuat#2026!",
			"portal":   "admin",
		})
		if stLogin != fiber.StatusOK {
			t.Fatalf("login tahap 1 harus 200, dapat %d", stLogin)
		}
		challenge, _ := loginBody["challenge"].(string)

		const workers = 8
		type resItem struct {
			status int
			token  string
			code   string
		}
		results := make([]resItem, workers)
		startGate := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startGate
				st, body, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
					"challenge":   challenge,
					"code":        codes[idx],
					"factor_type": "backup_code",
				})
				tok, _ := body["token"].(string)
				errCode, _ := body["code"].(string)
				results[idx] = resItem{status: st, token: tok, code: errCode}
			}(i)
		}
		close(startGate)
		wg.Wait()

		okCount := 0
		unauthCount := 0
		var winningToken string
		for _, r := range results {
			switch r.status {
			case fiber.StatusOK:
				okCount++
				winningToken = r.token
			case fiber.StatusUnauthorized:
				unauthCount++
			default:
				t.Fatalf("status tak terduga pada race JTI sama: %d (%s)", r.status, r.code)
			}
		}
		if okCount != 1 || unauthCount != workers-1 {
			t.Fatalf("race JTI sama wajib tepat 1 menang dan %d ditolak, aktual ok=%d unauth=%d", workers-1, okCount, unauthCount)
		}

		var sessCount int64
		pgDB.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = ?", staff.ID, false).Count(&sessCount)
		if sessCount != 1 {
			t.Fatalf("jumlah sesi aktif di PostgreSQL wajib 1, aktual %d", sessCount)
		}

		var comp rowsCheck
		if err := pgDB.Table("mfa_auth_completions").Select("COUNT(*) AS cnt, MAX(payload_enc) AS payload").
			Where("user_id = ?", staff.ID).Scan(&comp).Error; err != nil {
			t.Fatal(err)
		}
		if comp.Cnt != 1 {
			t.Fatalf("baris mfa_auth_completions wajib 1, aktual %d", comp.Cnt)
		}
		if !strings.HasPrefix(comp.Payload, "v1:") || (winningToken != "" && strings.Contains(comp.Payload, winningToken)) || strings.Contains(comp.Payload, "eyJ") {
			t.Fatal("payload_enc wajib terenkripsi AEAD (v1:) dan bebas dari bearer JWT plaintext")
		}

		// Hanya 1 dari 10 backup code yang boleh terpakai (9 tersisa).
		var updated models.User
		pgDB.First(&updated, staff.ID)
		var remHashes []string
		_ = json.Unmarshal([]byte(*updated.TwoFactorBackupCodesHash), &remHashes)
		if len(remHashes) != 9 {
			t.Fatalf("backup code tersisa wajib 9 (7 pecundang race tidak boleh membakar kode), aktual %d", len(remHashes))
		}
	})

	// --- Subtes 2: Goroutine paralel dengan challenge BERBEDA memakai kode faktor yang SAMA ---
	t.Run("parallel_distinct_challenges_same_totp_and_same_backup_code", func(t *testing.T) {
		staff := models.User{
			Name:         "PG Factor Race",
			Email:        "pg-factor-race@catavor.test",
			PlatformRole: "finance",
			TokenVersion: 1,
		}
		if err := staff.SetPassword("PostgresKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}
		secret, codes := seedEnrolledMFAForUser(t, pgDB, cfg, staff.ID, true)

		const workers = 6
		totpChallenges := make([]string, workers)
		for i := 0; i < workers; i++ {
			_, b, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
				"email": staff.Email, "password": "PostgresKuat#2026!", "portal": "admin",
			})
			totpChallenges[i], _ = b["challenge"].(string)
		}

		sameTOTP, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))
		if err != nil {
			t.Fatal(err)
		}

		totpStatuses := make([]int, workers)
		gate1 := make(chan struct{})
		var wg1 sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg1.Add(1)
			go func(idx int) {
				defer wg1.Done()
				<-gate1
				st, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
					"challenge": totpChallenges[idx], "code": sameTOTP, "factor_type": "totp",
				})
				totpStatuses[idx] = st
			}(i)
		}
		close(gate1)
		wg1.Wait()

		totpOK := 0
		for _, st := range totpStatuses {
			if st == fiber.StatusOK {
				totpOK++
			}
		}
		if totpOK != 1 {
			t.Fatalf("race paralel TOTP sama pada 6 challenge berbeda wajib tepat 1 sukses, aktual %d (%v)", totpOK, totpStatuses)
		}

		// Bersihkan lockout yang mungkin terpicu dari 5 pecundang replay sebelum menguji race backup code.
		pgDB.Where("user_id = ?", staff.ID).Delete(&models.MFAAccountLockout{})
		pgDB.Where("user_id = ?", staff.ID).Delete(&models.MFAChallengeFailure{})

		bcChallenges := make([]string, workers)
		for i := 0; i < workers; i++ {
			_, b, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
				"email": staff.Email, "password": "PostgresKuat#2026!", "portal": "admin",
			})
			bcChallenges[i], _ = b["challenge"].(string)
		}

		bcStatuses := make([]int, workers)
		gate2 := make(chan struct{})
		var wg2 sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg2.Add(1)
			go func(idx int) {
				defer wg2.Done()
				<-gate2
				st, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
					"challenge": bcChallenges[idx], "code": codes[0], "factor_type": "backup_code",
				})
				bcStatuses[idx] = st
			}(i)
		}
		close(gate2)
		wg2.Wait()

		bcOK := 0
		for _, st := range bcStatuses {
			if st == fiber.StatusOK {
				bcOK++
			}
		}
		if bcOK != 1 {
			t.Fatalf("race paralel backup_code sama pada 6 challenge berbeda wajib tepat 1 sukses, aktual %d (%v)", bcOK, bcStatuses)
		}
	})

	// --- Subtes 3: Race paralel ConfirmEnrollment ---
	t.Run("parallel_confirm_enrollment_race", func(t *testing.T) {
		staff := models.User{
			Name:         "PG Enroll Race",
			Email:        "pg-enroll-race@catavor.test",
			PlatformRole: "support",
			TokenVersion: 1,
		}
		if err := staff.SetPassword("PostgresKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}

		_, loginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email": staff.Email, "password": "PostgresKuat#2026!", "portal": "admin",
		})
		setupTok, _ := loginBody["setup_token"].(string)

		stEnroll, enrollBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/enroll", setupTok, map[string]interface{}{})
		if stEnroll != fiber.StatusOK {
			t.Fatalf("enroll harus 200, dapat %d", stEnroll)
		}
		enrollData, _ := enrollBody["data"].(map[string]interface{})
		secret, _ := enrollData["secret"].(string)
		setupJTI, _ := enrollData["setup_jti"].(string)
		code, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))

		const workers = 6
		statuses := make([]int, workers)
		gate := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-gate
				st, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/confirm", setupTok, map[string]interface{}{
					"code":      code,
					"setup_jti": setupJTI,
				})
				statuses[idx] = st
			}(i)
		}
		close(gate)
		wg.Wait()

		okCount := 0
		for _, st := range statuses {
			if st == fiber.StatusOK {
				okCount++
			}
		}
		if okCount != 1 {
			t.Fatalf("ConfirmEnrollment paralel wajib tepat 1 sukses (200), aktual %d (%v)", okCount, statuses)
		}

		var sessCount int64
		pgDB.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = ?", staff.ID, false).Count(&sessCount)
		if sessCount != 1 {
			t.Fatalf("ConfirmEnrollment paralel wajib menerbitkan tepat 1 sesi aktif, aktual %d", sessCount)
		}
	})

	// --- Subtes 4: Kegagalan DB sebelum commit membatalkan konsumsi faktor & tidak membocorkan sesi ---
	t.Run("db_session_failure_rolls_back_totp_and_backup_code_consumption", func(t *testing.T) {
		merch := models.User{
			Name:         "PG Rollback Merchant",
			Email:        "pg-rollback@catavor.test",
			PlatformRole: "merchant",
			TokenVersion: 1,
		}
		if err := merch.SetPassword("PostgresKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&merch).Error; err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&models.Store{UserID: merch.ID, Slug: "toko-pg-rb", StoreTitle: "PG Rollback", Plan: "free"}).Error; err != nil {
			t.Fatal(err)
		}
		secret, backupCodes := seedEnrolledMFAForUser(t, pgDB, cfg, merch.ID, false)

		_, loginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email": merch.Email, "password": "PostgresKuat#2026!", "portal": "merchant",
		})
		challenge, _ := loginBody["challenge"].(string)

		// Pasang trigger PostgreSQL sementara yang memicu kegagalan saat INSERT ke user_sessions
		// (terjadi SETELAH CAS faktor kedua di dalam RedeemChallenge).
		triggerSQL := `
			CREATE OR REPLACE FUNCTION fail_user_session_insert() RETURNS trigger AS $$
			BEGIN
				RAISE EXCEPTION 'simulated_session_write_failure';
			END;
			$$ LANGUAGE plpgsql;
			CREATE TRIGGER trg_fail_user_session_insert
			BEFORE INSERT ON user_sessions
			FOR EACH ROW EXECUTE FUNCTION fail_user_session_insert();
		`
		if err := pgDB.Exec(triggerSQL).Error; err != nil {
			t.Fatalf("pasang trigger simulasi kegagalan DB: %v", err)
		}
		cleanupTrigger := func() {
			_ = pgDB.Exec(`DROP TRIGGER IF EXISTS trg_fail_user_session_insert ON user_sessions; DROP FUNCTION IF EXISTS fail_user_session_insert();`).Error
		}
		defer cleanupTrigger()

		totpCode, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))

		// 4a. Verifikasi TOTP saat DB gagal menulis sesi -> wajib 503, tanpa token/cookie, step tetap 0!
		stFailTOTP, failBodyTOTP, failHdrTOTP := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": challenge, "code": totpCode, "factor_type": "totp",
		})
		if stFailTOTP != fiber.StatusServiceUnavailable {
			t.Fatalf("kegagalan tulis sesi DB harus 503 fail-closed, dapat %d: %v", stFailTOTP, failBodyTOTP)
		}
		assertNoSessionIssued(t, pgDB, merch.ID, failBodyTOTP, failHdrTOTP, "kegagalan DB saat verify TOTP")

		// 4b. Verifikasi backup_code saat DB gagal menulis sesi -> wajib 503, backup code tidak berkurang!
		stFailBC, failBodyBC, failHdrBC := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": challenge, "code": backupCodes[0], "factor_type": "backup_code",
		})
		if stFailBC != fiber.StatusServiceUnavailable {
			t.Fatalf("kegagalan tulis sesi DB pada backup_code harus 503, dapat %d", stFailBC)
		}
		assertNoSessionIssued(t, pgDB, merch.ID, failBodyBC, failHdrBC, "kegagalan DB saat verify backup_code")

		var afterFail models.User
		if err := pgDB.First(&afterFail, merch.ID).Error; err != nil {
			t.Fatal(err)
		}
		if afterFail.TwoFactorLastTOTPStep != 0 {
			t.Fatalf("ROLLBACK GAGAL: two_factor_last_totp_step berubah menjadi %d padahal sesi gagal disimpan", afterFail.TwoFactorLastTOTPStep)
		}
		var hashesAfterFail []string
		_ = json.Unmarshal([]byte(*afterFail.TwoFactorBackupCodesHash), &hashesAfterFail)
		if len(hashesAfterFail) != len(backupCodes) {
			t.Fatalf("ROLLBACK GAGAL: backup code berkurang dari %d menjadi %d padahal transaksi gagal", len(backupCodes), len(hashesAfterFail))
		}
		var compCount int64
		pgDB.Model(&models.MFAAuthCompletion{}).Where("user_id = ?", merch.ID).Count(&compCount)
		if compCount != 0 {
			t.Fatalf("ROLLBACK GAGAL: mfa_auth_completions tercatat %d baris", compCount)
		}

		// 4c. Pulihkan DB (hapus trigger) -> challenge & kode TOTP yang SAMA kini berhasil ditukarkan!
		cleanupTrigger()
		stRecovered, recBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": challenge, "code": totpCode, "factor_type": "totp",
		})
		if stRecovered != fiber.StatusOK {
			t.Fatalf("setelah DB pulih, challenge & TOTP yang belum terbakar harus 200, dapat %d: %v", stRecovered, recBody)
		}
		if tok, _ := recBody["token"].(string); tok == "" {
			t.Fatal("sesi penuh wajib terbit setelah DB pulih")
		}
	})

	// --- Subtes 5: Brute-force paralel lintas 8 challenge segar ---
	t.Run("parallel_fresh_jti_bruteforce_locks_account_deterministically", func(t *testing.T) {
		staff := models.User{
			Name:         "PG Lockout Target",
			Email:        "pg-lockout@catavor.test",
			PlatformRole: "content",
			TokenVersion: 1,
		}
		if err := staff.SetPassword("PostgresKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}
		_, backupCodes := seedEnrolledMFAForUser(t, pgDB, cfg, staff.ID, true)

		const attempts = 8
		challenges := make([]string, attempts)
		for i := 0; i < attempts; i++ {
			_, b, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
				"email": staff.Email, "password": "PostgresKuat#2026!", "portal": "admin",
			})
			challenges[i], _ = b["challenge"].(string)
		}

		gate := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < attempts; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-gate
				wrong := fmt.Sprintf("%06d", 900001+idx)
				doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
					"challenge": challenges[idx], "code": wrong, "factor_type": "totp",
				})
			}(i)
		}
		close(gate)
		wg.Wait()

		var lockRow models.MFAAccountLockout
		if err := pgDB.Where("user_id = ?", staff.ID).First(&lockRow).Error; err != nil {
			t.Fatalf("baris lockout wajib terbentuk: %v", err)
		}
		if lockRow.LockedUntil == nil || !time.Now().UTC().Before(*lockRow.LockedUntil) {
			t.Fatalf("akun wajib terkunci aktif setelah 8 percobaan salah paralel, dapat %+v", lockRow)
		}

		// Verifikasi berikutnya dengan backup code SAH wajib ditolak 429 MFA_LOCKED.
		stAfterLock, bodyAfterLock, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": challenges[0], "code": backupCodes[0], "factor_type": "backup_code",
		})
		if stAfterLock != fiber.StatusTooManyRequests || bodyAfterLock["code"] != "MFA_LOCKED" {
			t.Fatalf("setelah lockout paralel, kode sah harus 429 MFA_LOCKED, dapat %d (%v)", stAfterLock, bodyAfterLock["code"])
		}
	})

	// --- Subtes 6: DeleteAccount & CleanupExpiredUserSessions di PostgreSQL riil dengan FK RESTRICT mfa_auth_completions ---
	t.Run("delete_account_and_cleanup_sessions_with_pg_fk_restrict", func(t *testing.T) {
		cfg.StorageDriver = "local"
		cfg.StorageLocalRoot = t.TempDir()
		cfg.StoragePrivateRoot = t.TempDir()
		cfg.StorageDir = cfg.StorageLocalRoot
		if err := database.BootstrapProductionSchema(pgDB); err != nil {
			t.Fatalf("bootstrap skema penghapusan akun PostgreSQL: %v", err)
		}
		authH := NewAuthHandler(cfg, pgDB)
		app.Post("/api/user/account/delete", middleware.AuthRequired(cfg), authH.DeleteAccount)

		merch := models.User{
			Name:              "PG Delete Account MFA",
			Email:             "pg-del-mfa@catavor.test",
			PlatformRole:      "merchant",
			HasCustomPassword: true,
			IsPasswordChanged: true,
			TokenVersion:      1,
		}
		if err := merch.SetPassword("HapusAkunKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&merch).Error; err != nil {
			t.Fatal(err)
		}
		_, backupCodes := seedEnrolledMFAForUser(t, pgDB, cfg, merch.ID, false)

		store := models.Store{
			UserID:     merch.ID,
			Slug:       "toko-pg-del",
			StoreTitle: "Toko PG Delete",
			Plan:       "free",
		}
		if err := pgDB.Create(&store).Error; err != nil {
			t.Fatal(err)
		}
		prod := models.Product{
			StoreID:     store.ID,
			Name:        "Produk Uji Hapus PG",
			ProductType: "physical",
			Price:       25000,
			IsActive:    true,
		}
		if err := pgDB.Create(&prod).Error; err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&models.ProductVariant{ProductID: prod.ID, VariantName: "Standar", StockQty: 5, IsActive: true}).Error; err != nil {
			t.Fatal(err)
		}
		if err := pgDB.Create(&models.ProductImage{ProductID: prod.ID, ImageURL: "https://img.example/p.jpg", IsPrimary: true}).Error; err != nil {
			t.Fatal(err)
		}

		// Login + verifikasi MFA agar terbentuk baris user_sessions + mfa_auth_completions (FK RESTRICT).
		_, loginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email": merch.Email, "password": "HapusAkunKuat#2026!", "portal": "merchant",
		})
		chal, _ := loginBody["challenge"].(string)
		stVer, verBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": chal, "code": backupCodes[0], "factor_type": "backup_code",
		})
		if stVer != fiber.StatusOK {
			t.Fatalf("verify MFA sebelum delete account harus 200, dapat %d: %v", stVer, verBody)
		}
		tok, _ := verBody["token"].(string)

		// Tanpa mfa_code wajib ditantang 428 MFA_STEP_UP_REQUIRED.
		stNoMFA, bodyNoMFA, _ := doJSONReq(t, app, "POST", "/api/user/account/delete", tok, map[string]interface{}{
			"confirm_phrase": "HAPUS AKUN SAYA",
			"password":       "HapusAkunKuat#2026!",
		})
		if stNoMFA != fiber.StatusPreconditionRequired || bodyNoMFA["code"] != "MFA_STEP_UP_REQUIRED" {
			t.Fatalf("DeleteAccount ber-MFA tanpa mfa_code harus 428 MFA_STEP_UP_REQUIRED, dapat %d (%v)", stNoMFA, bodyNoMFA["code"])
		}

		// Dengan backup code kedua, penghapusan akun + toko + produk + varian + sesi + mfa_auth_completions wajib sukses 200 di PostgreSQL!
		stDel, bodyDel, _ := doJSONReq(t, app, "POST", "/api/user/account/delete", tok, map[string]interface{}{
			"confirm_phrase": "HAPUS AKUN SAYA",
			"password":       "HapusAkunKuat#2026!",
			"mfa_code":       backupCodes[1],
			"factor_type":    "backup_code",
		})
		if stDel != fiber.StatusOK {
			t.Fatalf("DeleteAccount di PostgreSQL wajib 200 tanpa melanggar FK RESTRICT maupun kolom product_variants, dapat %d: %v", stDel, bodyDel)
		}
	})
}

type rowsCheck struct {
	Cnt     int64  `gorm:"column:cnt"`
	Payload string `gorm:"column:payload"`
}

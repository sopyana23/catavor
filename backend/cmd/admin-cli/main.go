package main

import (
	"bufio"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/mail"
	"os"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type cliOptions struct {
	List                         bool
	Migrate                      bool
	BootstrapSchema              bool
	CheckGoLive                  bool
	RequireMFAEnrolled           bool
	ResetMFA                     bool
	Email                        string
	Name                         string
	PasswordFlag                 string
	PasswordEnv                  string
	PasswordStdin                bool
	TicketID                     string
	ApprovedBy                   string
	EmergencySingleAdminOverride bool
	VerifySchemaFn               func(*gorm.DB) ([]string, error)
}

func main() {
	var opts cliOptions
	flag.BoolVar(&opts.List, "list", false, "Daftar semua pengguna, role, dan status MFA mereka")
	flag.BoolVar(&opts.Migrate, "migrate", false, "Terapkan migrasi SQL tertanam dan pastikan skema fisik N-60 MFA")
	flag.BoolVar(&opts.BootstrapSchema, "bootstrap-schema", false, "Inisialisasi penuh skema produksi pada DB kosong tanpa data demo")
	flag.BoolVar(&opts.CheckGoLive, "check-go-live", false, "Audit kesiapan database produksi (skema, >=2 Superadmin, & penegakan MFA staf)")
	flag.BoolVar(&opts.RequireMFAEnrolled, "require-mfa-enrolled", false, "Wajibkan >=2 Superadmin aktif sudah menuntaskan aktivasi MFA TOTP (gunakan bersama -check-go-live)")
	flag.BoolVar(&opts.ResetMFA, "reset-mfa", false, "Mode pemulihan darurat Dual-Control Break-Glass MFA untuk staf terkunci")
	flag.StringVar(&opts.Email, "email", "", "Email akun Superadmin atau target pemulihan MFA")
	flag.StringVar(&opts.Name, "name", "Super Administrator", "Nama akun Superadmin")
	flag.BoolVar(&opts.PasswordStdin, "password-stdin", false, "Baca kata sandi secara aman dari baris pertama STDIN (direkomendasikan)")
	flag.StringVar(&opts.PasswordFlag, "password", "", "DEPRECATED: Kata sandi via argumen CLI (rawan terlihat di ps aux; gunakan -password-stdin atau ADMIN_CLI_PASSWORD)")
	flag.StringVar(&opts.TicketID, "ticket", "", "Nomor tiket insiden keamanan untuk audit Break-Glass MFA (contoh: INC-2026-001)")
	flag.StringVar(&opts.ApprovedBy, "approved-by", "", "Email Superadmin kedua penyetuju pemulihan Break-Glass MFA (Dual-Control)")
	flag.BoolVar(&opts.EmergencySingleAdminOverride, "emergency-single-admin-override", false, "Override darurat hanya bila jumlah Superadmin aktif ber-MFA di sistem < 2")
	flag.Parse()

	opts.PasswordEnv = os.Getenv("ADMIN_CLI_PASSWORD")

	cfg := config.LoadConfig()
	db, err := gorm.Open(postgres.Open(cfg.GetPostgresDSN()), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "[GAGAL] Koneksi ke PostgreSQL gagal: %v\n", err)
		os.Exit(1)
	}

	// Hubungkan Redis untuk pencabutan sesi instan (JTI blacklist) pada operasi mutasi akun/MFA.
	if opts.ResetMFA || (strings.TrimSpace(opts.Email) != "" && !opts.List && !opts.CheckGoLive && !opts.Migrate && !opts.BootstrapSchema) {
		database.InitRedis()
	}

	code := runAdminCLI(db, opts, os.Stdin, os.Stdout, os.Stderr)
	os.Exit(code)
}

func runAdminCLI(db *gorm.DB, opts cliOptions, stdin io.Reader, stdout, stderr io.Writer) int {
	if opts.BootstrapSchema {
		return executeBootstrapSchema(db, stdout, stderr)
	}
	if opts.Migrate {
		return executeMigrate(db, stdout, stderr)
	}
	if opts.CheckGoLive {
		return executeCheckGoLive(db, opts, stdout, stderr)
	}
	if opts.ResetMFA {
		return executeBreakGlassMFAReset(db, opts, stdout, stderr)
	}

	noActionArgs := strings.TrimSpace(opts.Email) == "" &&
		opts.PasswordFlag == "" &&
		opts.PasswordEnv == "" &&
		!opts.PasswordStdin

	if opts.List || noActionArgs {
		if code := executeListUsers(db, stdout, stderr); code != 0 {
			return code
		}
		if strings.TrimSpace(opts.Email) == "" {
			return 0
		}
	}

	return executeProvisionSuperadmin(db, opts, stdin, stdout, stderr)
}

func executeBootstrapSchema(db *gorm.DB, stdout, stderr io.Writer) int {
	if err := database.BootstrapProductionSchema(db); err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Bootstrap skema produksi gagal: %v\n", err)
		return 1
	}
	if err := services.SeedSubscriptionPlans(db); err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Seeding master paket langganan gagal: %v\n", err)
		return 1
	}
	fmt.Fprintln(stdout, "[BERHASIL] Skema produksi, matriks RBAC, migrasi SQL, dan paket dasar berhasil diinisialisasi tanpa data demo.")
	return 0
}

func executeMigrate(db *gorm.DB, stdout, stderr io.Writer) int {
	if err := database.RunMigrations(db); err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Migrasi SQL gagal: %v\n", err)
		return 1
	}
	if err := database.EnsureN60MFASchema(db); err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Penyelarasan skema N-60 MFA gagal: %v\n", err)
		return 1
	}
	if db.Migrator().HasTable(&models.SubscriptionPlan{}) {
		var planCount int64
		if err := db.Model(&models.SubscriptionPlan{}).Count(&planCount).Error; err == nil && planCount == 0 {
			_ = services.SeedSubscriptionPlans(db)
		}
	}
	fmt.Fprintln(stdout, "[BERHASIL] Seluruh migrasi SQL tertanam dan skema fisik N-60 MFA berhasil diterapkan.")
	return 0
}

func executeListUsers(db *gorm.DB, stdout, stderr io.Writer) int {
	var users []models.User
	if err := db.Order("id asc").Find(&users).Error; err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Gagal mengambil data pengguna: %v\n", err)
		return 1
	}

	fmt.Fprintf(stdout, "\n=== DAFTAR PENGGUNA SISTEM CATAVOR (Total: %d) ===\n", len(users))
	fmt.Fprintf(stdout, "%-5s | %-32s | %-20s | %-14s | %-14s | %s\n", "ID", "EMAIL", "NAMA", "ROLE", "MFA", "STATUS")
	fmt.Fprintln(stdout, strings.Repeat("-", 104))
	for _, u := range users {
		status := "Aktif"
		if u.IsBlacklisted {
			status = "Blacklisted"
		}
		mfaStatus := "Nonaktif"
		if u.TwoFactorEnabled {
			mfaStatus = "Aktif (TOTP)"
		} else if u.TwoFactorEnforced || u.IsPlatformStaff() {
			mfaStatus = "Wajib-Belum"
		}
		fmt.Fprintf(stdout, "%-5d | %-32s | %-20s | %-14s | %-14s | %s\n",
			u.ID, u.Email, u.Name, u.PlatformRole, mfaStatus, status)
	}
	fmt.Fprintln(stdout)
	return 0
}

func executeCheckGoLive(db *gorm.DB, opts cliOptions, stdout, stderr io.Writer) int {
	verifyFn := opts.VerifySchemaFn
	if verifyFn == nil {
		verifyFn = database.VerifyProductionSchema
	}

	schemaIssues, err := verifyFn(db)
	if err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Pemeriksaan skema database gagal: %v\n", err)
		return 1
	}

	var issues []string
	issues = append(issues, schemaIssues...)

	if db.Migrator().HasTable("users") {
		var activeSuperadmins int64
		if err := db.Model(&models.User{}).
			Where("LOWER(TRIM(platform_role)) = ? AND is_blacklisted = ?", "superadmin", false).
			Count(&activeSuperadmins).Error; err != nil {
			fmt.Fprintf(stderr, "[GAGAL] Gagal menghitung akun Superadmin: %v\n", err)
			return 1
		}
		if activeSuperadmins < 2 {
			issues = append(issues, fmt.Sprintf("jumlah akun Superadmin aktif (%d) kurang dari minimum standar Dual-Control (wajib >= 2 akun Superadmin terpisah)", activeSuperadmins))
		}

		var enrolledSuperadmins int64
		if db.Migrator().HasColumn(&models.User{}, "two_factor_enabled") {
			if err := db.Model(&models.User{}).
				Where("LOWER(TRIM(platform_role)) = ? AND is_blacklisted = ? AND two_factor_enabled = ? AND two_factor_secret_enc IS NOT NULL AND two_factor_secret_enc <> ''",
					"superadmin", false, true).
				Count(&enrolledSuperadmins).Error; err != nil {
				fmt.Fprintf(stderr, "[GAGAL] Gagal menghitung status MFA Superadmin: %v\n", err)
				return 1
			}
			if opts.RequireMFAEnrolled && enrolledSuperadmins < 2 {
				issues = append(issues, fmt.Sprintf("jumlah Superadmin aktif yang sudah menuntaskan aktivasi MFA TOTP (%d) kurang dari minimum Go-Live (wajib >= 2)", enrolledSuperadmins))
			}
		}

		if db.Migrator().HasColumn(&models.User{}, "two_factor_enforced") {
			var unenforcedStaff int64
			if err := db.Model(&models.User{}).
				Where("LOWER(TRIM(platform_role)) IN ? AND is_blacklisted = ? AND two_factor_enforced = ?",
					[]string{"superadmin", "admin", "compliance", "support", "finance", "content"}, false, false).
				Count(&unenforcedStaff).Error; err != nil {
				fmt.Fprintf(stderr, "[GAGAL] Gagal memeriksa penegakan MFA staf: %v\n", err)
				return 1
			}
			if unenforcedStaff > 0 {
				issues = append(issues, fmt.Sprintf("ditemukan %d akun staf platform aktif dengan two_factor_enforced = false (jalankan admin-cli -migrate)", unenforcedStaff))
			}
		}

		fmt.Fprintf(stdout, "=== RINGKASAN AUDIT GO-LIVE DATABASE CATAVOR ===\n")
		fmt.Fprintf(stdout, "- Superadmin Aktif           : %d (minimum: 2)\n", activeSuperadmins)
		fmt.Fprintf(stdout, "- Superadmin MFA Terdaftar   : %d\n", enrolledSuperadmins)
		fmt.Fprintf(stdout, "- Temuan Ketidaksesuaian     : %d\n", len(issues))
	}

	if len(issues) > 0 {
		fmt.Fprintln(stderr, "\n[BELUM SIAP GO-LIVE] Selesaikan daftar prasyarat berikut:")
		for idx, item := range issues {
			fmt.Fprintf(stderr, "  %d. %s\n", idx+1, item)
		}
		return 1
	}

	fmt.Fprintln(stdout, "[SIAP GO-LIVE] Seluruh pemeriksaan skema, kuorum >= 2 Superadmin, dan penegakan MFA staf lulus.")
	return 0
}

func resolveCLIPassword(opts cliOptions, stdin io.Reader, stderr io.Writer) (string, error) {
	sources := 0
	if opts.PasswordStdin {
		sources++
	}
	if opts.PasswordEnv != "" {
		sources++
	}
	if opts.PasswordFlag != "" {
		sources++
	}
	if sources == 0 {
		return "", errors.New("kata sandi wajib disuplai melalui -password-stdin atau environment variable ADMIN_CLI_PASSWORD")
	}
	if sources > 1 {
		return "", errors.New("gunakan tepat satu sumber kata sandi (-password-stdin ATAU ADMIN_CLI_PASSWORD) agar tidak ambigu")
	}

	if opts.PasswordStdin {
		if stdin == nil {
			return "", errors.New("STDIN tidak tersedia untuk -password-stdin")
		}
		reader := bufio.NewReader(stdin)
		line, err := reader.ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return "", fmt.Errorf("gagal membaca kata sandi dari STDIN: %w", err)
		}
		// NIST SP 800-63B: jangan trim spasi yang disengaja pengguna; hanya hapus newline ujung baris.
		pw := strings.TrimRight(line, "\r\n")
		if pw == "" {
			return "", errors.New("kata sandi dari STDIN kosong")
		}
		return pw, nil
	}

	if opts.PasswordEnv != "" {
		return opts.PasswordEnv, nil
	}

	fmt.Fprintln(stderr, "[PERINGATAN KEAMANAN] Argumen -password dapat terlihat pada tabel proses OS (ps aux). Gunakan -password-stdin atau ADMIN_CLI_PASSWORD di produksi.")
	return opts.PasswordFlag, nil
}

func normalizeValidEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", errors.New("alamat email wajib diisi")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || !strings.EqualFold(parsed.Address, email) {
		return "", fmt.Errorf("format alamat email tidak valid: %s", email)
	}
	return email, nil
}

func executeProvisionSuperadmin(db *gorm.DB, opts cliOptions, stdin io.Reader, stdout, stderr io.Writer) int {
	email, err := normalizeValidEmail(opts.Email)
	if err != nil {
		fmt.Fprintf(stderr, "[GAGAL] %v\n", err)
		return 1
	}

	password, err := resolveCLIPassword(opts, stdin, stderr)
	if err != nil {
		fmt.Fprintf(stderr, "[GAGAL] %v\n", err)
		return 1
	}
	if err := security.ValidatePassword(password); err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Kata sandi tidak memenuhi standar keamanan: %v\n", err)
		return 1
	}

	now := time.Now().UTC()
	var provisionedUser models.User
	var isCreated bool

	txErr := db.Transaction(func(tx *gorm.DB) error {
		var existing models.User
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("LOWER(email) = ?", email).
			First(&existing).Error

		if err == nil {
			var storeCount int64
			if err := tx.Model(&models.Store{}).Where("user_id = ?", existing.ID).Count(&storeCount).Error; err != nil {
				return err
			}
			if storeCount > 0 {
				return errors.New("akun ini memiliki toko merchant aktif; dilarang mempromosikan akun tenant merchant menjadi Superadmin platform")
			}

			oldRole := existing.PlatformRole
			if err := existing.SetPassword(password); err != nil {
				return fmt.Errorf("gagal mengenkripsi kata sandi: %w", err)
			}
			existing.PlatformRole = "superadmin"
			existing.TwoFactorEnforced = true
			existing.IsBlacklisted = false
			if existing.EmailVerifiedAt == nil {
				existing.EmailVerifiedAt = &now
			}
			existing.IsPasswordChanged = true
			existing.HasCustomPassword = true
			existing.TokenVersion++

			trimmedName := strings.TrimSpace(opts.Name)
			if trimmedName != "" && trimmedName != "Super Administrator" {
				existing.Name = trimmedName
			}

			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
			if err := revokeSessionsInTx(tx, existing.ID, now); err != nil {
				return err
			}
			if err := writeCLIAuditLog(tx, &existing.ID, existing.Email, existing.Name, "CLI_SUPERADMIN_UPDATED",
				fmt.Sprintf("Akun '%s' diperbarui/dipromosikan menjadi superadmin melalui admin-cli (role sebelumnya: '%s', two_factor_enforced: true).", existing.Email, oldRole),
				map[string]interface{}{"previous_role": oldRole, "new_role": "superadmin", "two_factor_enforced": true}, now); err != nil {
				return err
			}
			provisionedUser = existing
			return nil
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		name := strings.TrimSpace(opts.Name)
		if name == "" {
			name = "Super Administrator"
		}
		newUser := models.User{
			Name:              name,
			Email:             email,
			EmailVerifiedAt:   &now,
			PlatformRole:      "superadmin",
			TwoFactorEnforced: true,
			IsBlacklisted:     false,
			IsPasswordChanged: true,
			HasCustomPassword: true,
			TokenVersion:      1,
		}
		if err := newUser.SetPassword(password); err != nil {
			return fmt.Errorf("gagal mengenkripsi kata sandi: %w", err)
		}
		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}
		if err := writeCLIAuditLog(tx, &newUser.ID, newUser.Email, newUser.Name, "CLI_SUPERADMIN_CREATED",
			fmt.Sprintf("Akun Superadmin baru '%s' dibuat melalui admin-cli (two_factor_enforced: true; wajib aktivasi MFA saat login pertama).", newUser.Email),
			map[string]interface{}{"role": "superadmin", "two_factor_enforced": true}, now); err != nil {
			return err
		}
		provisionedUser = newUser
		isCreated = true
		return nil
	})

	if txErr != nil {
		fmt.Fprintf(stderr, "[GAGAL] Provisioning Superadmin dibatalkan: %v\n", txErr)
		return 1
	}

	if !isCreated {
		_ = services.RevokeAllSessionsForUser(db, provisionedUser.ID)
		fmt.Fprintf(stdout, "[BERHASIL] Pengguna ID #%d (%s) diperbarui menjadi SUPER ADMIN (MFA wajib aktif, sesi lama dicabut).\n",
			provisionedUser.ID, provisionedUser.Email)
		return 0
	}

	fmt.Fprintf(stdout, "[BERHASIL] Akun Super Admin baru dibuat dengan ID #%d (%s). Saat login pertama, sistem akan mewajibkan pendaftaran MFA TOTP.\n",
		provisionedUser.ID, provisionedUser.Email)
	return 0
}

func executeBreakGlassMFAReset(db *gorm.DB, opts cliOptions, stdout, stderr io.Writer) int {
	targetEmail, err := normalizeValidEmail(opts.Email)
	if err != nil {
		fmt.Fprintf(stderr, "[GAGAL] Parameter -email tidak valid: %v\n", err)
		return 1
	}
	ticketID := strings.TrimSpace(opts.TicketID)
	if len(ticketID) < 4 || len(ticketID) > 64 {
		fmt.Fprintln(stderr, "[GAGAL] Parameter -ticket wajib diisi untuk jejak audit insiden (4–64 karakter, contoh: INC-2026-001).")
		return 1
	}

	var approverEmail string
	if !opts.EmergencySingleAdminOverride {
		approverEmail, err = normalizeValidEmail(opts.ApprovedBy)
		if err != nil {
			fmt.Fprintf(stderr, "[GAGAL] Parameter -approved-by wajib berisi email Superadmin kedua yang sah: %v\n", err)
			return 1
		}
		if strings.EqualFold(targetEmail, approverEmail) {
			fmt.Fprintln(stderr, "[GAGAL] Pelanggaran Dual-Control: -approved-by tidak boleh sama dengan akun -email yang sedang dipulihkan.")
			return 1
		}
	} else if strings.TrimSpace(opts.ApprovedBy) != "" {
		approverEmail, err = normalizeValidEmail(opts.ApprovedBy)
		if err != nil {
			fmt.Fprintf(stderr, "[GAGAL] Format -approved-by tidak valid: %v\n", err)
			return 1
		}
	}

	now := time.Now().UTC()
	var resetTargetID uint

	txErr := db.Transaction(func(tx *gorm.DB) error {
		var target models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("LOWER(email) = ?", targetEmail).
			First(&target).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("akun target '%s' tidak ditemukan", targetEmail)
			}
			return err
		}
		if target.IsBlacklisted {
			return fmt.Errorf("akun target '%s' berstatus blacklisted; pemulihan MFA ditolak", targetEmail)
		}
		if !target.IsPlatformStaff() && !target.TwoFactorEnabled && !target.TwoFactorEnforced {
			return fmt.Errorf("akun '%s' tidak memiliki faktor kedua aktif", targetEmail)
		}

		var approverID *uint
		actorEmail := approverEmail
		actorName := "Break-Glass CLI Dual-Control"
		overrideMode := false

		var enrolledSuperadmins int64
		if err := tx.Model(&models.User{}).
			Where("LOWER(TRIM(platform_role)) = ? AND is_blacklisted = ? AND two_factor_enabled = ?", "superadmin", false, true).
			Count(&enrolledSuperadmins).Error; err != nil {
			return err
		}

		if opts.EmergencySingleAdminOverride {
			if enrolledSuperadmins >= 2 {
				return fmt.Errorf("override darurat ditolak: terdapat %d Superadmin aktif ber-MFA di sistem; wajib gunakan persetujuan Dual-Control (-approved-by)", enrolledSuperadmins)
			}
			overrideMode = true
			if actorEmail == "" {
				actorEmail = "system-break-glass@local"
			}
			actorName = "Break-Glass Genesis Override"
		} else {
			var approver models.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("LOWER(email) = ?", approverEmail).
				First(&approver).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return fmt.Errorf("Superadmin penyetuju '%s' tidak ditemukan", approverEmail)
				}
				return err
			}
			if approver.ID == target.ID {
				return errors.New("Superadmin penyetuju tidak boleh sama dengan akun target")
			}
			if approver.IsBlacklisted || !strings.EqualFold(strings.TrimSpace(approver.PlatformRole), "superadmin") {
				return fmt.Errorf("akun '%s' bukan Superadmin aktif yang sah", approverEmail)
			}
			if !approver.TwoFactorEnabled || approver.TwoFactorSecretEnc == nil || *approver.TwoFactorSecretEnc == "" {
				return fmt.Errorf("Superadmin penyetuju '%s' belum mengaktifkan MFA TOTP", approverEmail)
			}
			approverID = &approver.ID
			actorEmail = approver.Email
			actorName = approver.Name
		}

		enforcedAfterReset := target.IsPlatformStaff() || target.TwoFactorEnforced
		if err := tx.Model(&models.User{}).Where("id = ?", target.ID).Updates(map[string]interface{}{
			"two_factor_enabled":           false,
			"two_factor_enforced":          enforcedAfterReset,
			"two_factor_secret_enc":        nil,
			"two_factor_backup_codes_hash": nil,
			"two_factor_enrolled_at":       nil,
			"two_factor_setup_jti":         nil,
			"two_factor_last_totp_step":    0,
			"token_version":                gorm.Expr("token_version + 1"),
			"updated_at":                   now,
		}).Error; err != nil {
			return fmt.Errorf("gagal mereset kolom MFA pengguna: %w", err)
		}

		if err := tx.Where("user_id = ?", target.ID).Delete(&models.MFAAccountLockout{}).Error; err != nil {
			return fmt.Errorf("gagal menghapus lockout MFA: %w", err)
		}
		if err := tx.Where("user_id = ?", target.ID).Delete(&models.MFAChallengeFailure{}).Error; err != nil {
			return fmt.Errorf("gagal membersihkan kegagalan challenge MFA: %w", err)
		}
		if err := revokeSessionsInTx(tx, target.ID, now); err != nil {
			return err
		}

		nonceBytes := make([]byte, 16)
		if _, err := rand.Read(nonceBytes); err != nil {
			return fmt.Errorf("gagal membangkitkan nonce audit: %w", err)
		}
		nonceHex := hex.EncodeToString(nonceBytes)
		cancelSum := sha256.Sum256([]byte("break-glass|" + ticketID + "|" + nonceHex))
		cancelHash := hex.EncodeToString(cancelSum[:])
		execMethod := "admin_cli_dual_control"
		if overrideMode {
			execMethod = "admin_cli_single_admin_override"
		}
		actorRef := fmt.Sprintf("%s (%s)", actorEmail, ticketID)
		if len(actorRef) > 100 {
			actorRef = actorRef[:100]
		}

		recoveryRecord := models.TwoFactorRecoveryTicket{
			UserID:                target.ID,
			State:                 "EXECUTED",
			RequestedAt:           now,
			VerifiedByStaffID:     approverID,
			VerifiedAt:            &now,
			CancellationTokenHash: cancelHash,
			Approver1StaffID:      approverID,
			Approver1Nonce:        &nonceHex,
			Approver1At:           &now,
			ExecutionMethod:       &execMethod,
			BreakGlassNonce:       &nonceHex,
			BreakGlassActor:       &actorRef,
			ExecutedAt:            &now,
			CreatedAt:             now,
			UpdatedAt:             now,
		}
		if err := tx.Create(&recoveryRecord).Error; err != nil {
			return fmt.Errorf("gagal mencatat tiket pemulihan MFA: %w", err)
		}

		auditActorID := approverID
		if auditActorID == nil {
			auditActorID = &target.ID
		}
		if err := writeCLIAuditLog(tx, auditActorID, actorEmail, actorName, "SECURITY_BREAK_GLASS_MFA_RESET",
			fmt.Sprintf("Break-Glass MFA reset dieksekusi untuk '%s' berdasarkan tiket '%s' (disetujui oleh: '%s', override: %t). Seluruh sesi dicabut dan pendaftaran ulang MFA diwajibkan.",
				target.Email, ticketID, actorEmail, overrideMode),
			map[string]interface{}{
				"target_user_id":      target.ID,
				"target_email":        target.Email,
				"ticket_id":           ticketID,
				"approved_by":         actorEmail,
				"execution_method":    execMethod,
				"recovery_ticket_id":  recoveryRecord.ID,
				"two_factor_enforced": enforcedAfterReset,
			}, now); err != nil {
			return err
		}

		resetTargetID = target.ID
		return nil
	})

	if txErr != nil {
		fmt.Fprintf(stderr, "[GAGAL] Pemulihan Break-Glass MFA ditolak: %v\n", txErr)
		return 1
	}

	// Pastikan sesi aktif ikut masuk daftar hitam Redis bila Redis aktif.
	_ = services.RevokeAllSessionsForUser(db, resetTargetID)
	database.ResetLoginFailures(targetEmail)

	fmt.Fprintf(stdout, "[BERHASIL] Faktor MFA untuk '%s' telah direset secara teraudit (Tiket: %s). Seluruh sesi aktif telah dicabut dan pengguna wajib mendaftarkan MFA baru saat login berikutnya.\n",
		targetEmail, ticketID)
	return 0
}

func revokeSessionsInTx(tx *gorm.DB, userID uint, now time.Time) error {
	if !tx.Migrator().HasTable("user_sessions") {
		return nil
	}
	return tx.Model(&models.UserSession{}).
		Where("user_id = ? AND is_revoked = ?", userID, false).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": &now,
			"updated_at": now,
		}).Error
}

func writeCLIAuditLog(
	tx *gorm.DB,
	actorID *uint,
	actorEmail string,
	actorName string,
	action string,
	description string,
	changes map[string]interface{},
	now time.Time,
) error {
	if !tx.Migrator().HasTable("activity_logs") {
		return nil
	}
	rawChanges, err := json.Marshal(changes)
	if err != nil {
		return err
	}
	entry := models.ActivityLog{
		UserID:      actorID,
		ActorRole:   "superadmin",
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      action,
		Category:    "security",
		EntityType:  "user",
		EntityID:    actorID,
		EntityTitle: actorEmail,
		Description: description,
		Changes:     datatypes.JSON(rawChanges),
		IPAddress:   "127.0.0.1",
		UserAgent:   "catavor-admin-cli",
		CreatedAt:   now,
	}
	return tx.Create(&entry).Error
}

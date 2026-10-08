package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type OTPService struct {
	db *gorm.DB
}

var globalOTPService *OTPService

func InitOTPService(db *gorm.DB) *OTPService {
	globalOTPService = &OTPService{db: db}
	return globalOTPService
}

func GetOTPService() *OTPService {
	return globalOTPService
}

// hashOTP hashes an OTP code using SHA-256 for secure database storage.
func hashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// GenerateCryptographicOTP generates a 6-digit numeric OTP string using crypto/rand.
func GenerateCryptographicOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}

// GenerateAndSendRegistrationOTP generates and sends an email verification OTP.
func (s *OTPService) GenerateAndSendRegistrationOTP(email string, recipientName string) (string, error) {
	return s.generateAndSendOTP(email, recipientName, "registration", "Verifikasi Pendaftaran Akun Catavor", "Gunakan kode berikut untuk mengonfirmasi pendaftaran akun pengelola toko Anda:")
}

// GenerateAndSendPasswordResetOTP generates and sends an OTP for forgotten password recovery.
func (s *OTPService) GenerateAndSendPasswordResetOTP(email string, recipientName string) (string, error) {
	return s.generateAndSendOTP(email, recipientName, "password_reset", "Atur Ulang Kata Sandi Akun Catavor", "Gunakan kode berikut untuk memulihkan dan mengatur ulang kata sandi akun Anda:")
}

func (s *OTPService) generateAndSendOTP(email string, recipientName string, purpose string, subject string, introText string) (string, error) {
	cleanedEmail := strings.TrimSpace(strings.ToLower(email))
	if cleanedEmail == "" {
		return "", fmt.Errorf("alamat email wajib diisi")
	}

	// 1. Rate Limit Check: Enforce minimum 60-second cooldown between requests for the same email & purpose
	var latestOTP models.EmailVerificationOTP
	err := s.db.Where("email = ? AND purpose = ?", cleanedEmail, purpose).
		Order("created_at DESC").
		First(&latestOTP).Error

	if err == nil {
		cooldown := 60 * time.Second
		if time.Since(latestOTP.CreatedAt) < cooldown {
			remainingSec := int(cooldown.Seconds() - time.Since(latestOTP.CreatedAt).Seconds())
			return "", fmt.Errorf("mohon tunggu %d detik sebelum meminta kode baru", remainingSec)
		}
	}

	// 2. Invalidate any previous unexpired OTPs for this email and purpose
	_ = s.db.Where("email = ? AND purpose = ? AND expires_at > ?", cleanedEmail, purpose, time.Now()).
		Delete(&models.EmailVerificationOTP{}).Error

	// 3. Generate a 6-digit cryptographic OTP
	otpCode, err := GenerateCryptographicOTP()
	if err != nil {
		log.Error().Err(err).Msg("OTPService: Failed to generate cryptographic random OTP")
		return "", fmt.Errorf("gagal membuat kode verifikasi")
	}

	otpHash := hashOTP(otpCode)
	expiresAt := time.Now().Add(5 * time.Minute) // 5 minutes validity

	// 4. Save to Database
	newRecord := models.EmailVerificationOTP{
		Email:     cleanedEmail,
		OTPHash:   otpHash,
		Purpose:   purpose,
		Attempts:  0,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}

	if err := s.db.Create(&newRecord).Error; err != nil {
		log.Error().Err(err).Msg("OTPService: Failed to persist OTP record")
		return "", fmt.Errorf("gagal menyimpan kode verifikasi")
	}

	// 5. Construct Beautiful Modern HTML Email Template
	if recipientName == "" {
		recipientName = "Pengelola Katalog"
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #0284c7 0%%, #2563eb 100%%); text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">CATAVOR</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #e0f2fe; font-weight: 500;">Platform Katalog & Toko Digital Mandiri</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Halo, %s</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                %s
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #0f172a; border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px 24px;">
                    <span style="font-size: 12px; font-weight: 700; color: #38bdf8; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 6px;">Kode Verifikasi Rahasia</span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff;">%s</span>
                  </td>
                </tr>
              </table>

              <!-- Notice & Validity -->
              <p style="margin: 20px 0 0 0; font-size: 13px; color: #cbd5e1; line-height: 1.5; text-align: center;">
                ⏱️ Kode ini hanya berlaku selama <strong>5 menit</strong>.<br>
                <span style="color: #ef4444; font-size: 12px;">Jangan berikan kode ini kepada siapa pun, termasuk pihak yang mengatasnamakan Catavor.</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini dengan aman.<br>
                &copy; %d Catavor Platform. Seluruh hak cipta dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, recipientName, introText, otpCode, time.Now().Year())

	// 6. Send the Email via SMTP Service (Gracefully logs if SMTP is not configured)
	go func() {
		_ = SendHTMLEmail(cleanedEmail, subject, "Catavor Security", htmlBody)
	}()

	log.Info().Str("email", cleanedEmail).Str("purpose", purpose).Msg("OTP generated and email dispatched")
	return otpCode, nil
}

// VerifyOTP verifies a user-submitted OTP code against the database.
// If valid, returns a one-time verification token (valid for 15 minutes) to finalize the transaction.
func (s *OTPService) VerifyOTP(email string, code string, purpose string) (string, error) {
	cleanedEmail := strings.TrimSpace(strings.ToLower(email))
	cleanedCode := strings.TrimSpace(code)

	if cleanedEmail == "" || cleanedCode == "" {
		return "", fmt.Errorf("email dan kode verifikasi wajib diisi")
	}

	var record models.EmailVerificationOTP
	err := s.db.Where("email = ? AND purpose = ?", cleanedEmail, purpose).
		Order("created_at DESC").
		First(&record).Error

	if err != nil {
		return "", fmt.Errorf("kode verifikasi tidak ditemukan atau belum pernah diminta")
	}

	// Check expiration
	if time.Now().After(record.ExpiresAt) {
		_ = s.db.Delete(&record)
		return "", fmt.Errorf("kode verifikasi telah kedaluwarsa. Silakan minta kode baru")
	}

	// Check maximum attempts (Max 3 failed attempts)
	if record.Attempts >= 3 {
		_ = s.db.Delete(&record)
		return "", fmt.Errorf("batas percobaan salah telah terlampaui. Silakan minta kode baru")
	}

	// Verify Hash
	providedHash := hashOTP(cleanedCode)
	if record.OTPHash != providedHash {
		// Increment attempts
		record.Attempts++
		s.db.Save(&record)
		remaining := 3 - record.Attempts
		return "", fmt.Errorf("kode verifikasi salah. Sisa kesempatan: %d kali", remaining)
	}

	// Generate one-time verification token
	verificationToken := "vt_" + uuid.New().String()
	record.Token = verificationToken
	record.ExpiresAt = time.Now().Add(15 * time.Minute) // Give 15 mins to complete form
	s.db.Save(&record)

	return verificationToken, nil
}

// ValidateAndConsumeToken verifies that a verificationToken was legitimately issued for the email and consumes it.
func (s *OTPService) ValidateAndConsumeToken(email string, token string, purpose string) bool {
	cleanedEmail := strings.TrimSpace(strings.ToLower(email))
	cleanedToken := strings.TrimSpace(token)

	if cleanedEmail == "" || cleanedToken == "" {
		return false
	}

	var record models.EmailVerificationOTP
	err := s.db.Where("email = ? AND token = ? AND purpose = ? AND expires_at > ?", cleanedEmail, cleanedToken, purpose, time.Now()).
		First(&record).Error

	if err != nil {
		return false
	}

	// Consume token so it cannot be reused
	_ = s.db.Delete(&record)
	return true
}

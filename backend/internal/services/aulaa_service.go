package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

const (
	DefaultAulaaBaseURL = "https://api.aulaa.co/v1"
	DefaultHTTPTimeout  = 10 * time.Second
)

// AulaaConfig holds runtime configuration for the Aulaa Payment Gateway
type AulaaConfig struct {
	BaseURL       string
	APIKey        string
	WebhookSecret string
}

// GetAulaaConfig retrieves active Aulaa credentials from the database settings
func GetAulaaConfig(db *gorm.DB) AulaaConfig {
	cfg := AulaaConfig{
		BaseURL: DefaultAulaaBaseURL,
	}
	if db == nil {
		return cfg
	}

	var settings []models.Setting
	if err := db.Where("key IN ?", []string{
		"aulaa_base_url",
		"aulaa_api_key",
		"aulaa_webhook_secret",
	}).Find(&settings).Error; err == nil {
		for _, s := range settings {
			switch s.Key {
			case "aulaa_base_url":
				if strings.TrimSpace(s.Value) != "" {
					cfg.BaseURL = strings.TrimRight(strings.TrimSpace(s.Value), "/")
				}
			case "aulaa_api_key":
				cfg.APIKey = strings.TrimSpace(s.Value)
			case "aulaa_webhook_secret":
				cfg.WebhookSecret = strings.TrimSpace(s.Value)
			}
		}
	}
	return cfg
}

// AulaaCreatePaymentRequest represents the payload for POST /v1/payments
type AulaaCreatePaymentRequest struct {
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	RedirectURL string  `json:"redirect_url"`
}

// AulaaCreatePaymentResponse represents the response from POST /v1/payments
type AulaaCreatePaymentResponse struct {
	ID          string  `json:"id"`
	OrderID     string  `json:"order_id"`
	Amount      float64 `json:"amount"`
	Status      string  `json:"status"`
	PaymentLink string  `json:"payment_link"`
	CreatedAt   string  `json:"created_at,omitempty"`
}

// AulaaPaymentStatusResponse represents the response from GET /v1/payments/{id}
type AulaaPaymentStatusResponse struct {
	ID              string  `json:"id"`
	OrderID         string  `json:"order_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Status          string  `json:"status"`
	PaymentMethod   string  `json:"payment_method,omitempty"`
	FormattedAmount string  `json:"formatted_amount,omitempty"`
	PaymentLink     string  `json:"payment_link,omitempty"`
}

// AulaaWebhookPayload represents the incoming server-to-server webhook JSON from Aulaa
type AulaaWebhookPayload struct {
	OrderID         string  `json:"order_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	CountryCode     string  `json:"country_code"`
	Status          string  `json:"status"` // paid | expired | cancelled
	PaymentMethod   string  `json:"payment_method"`
	FormattedAmount string  `json:"formatted_amount"`
}

// VerifyAulaaSignature validates the raw body HMAC-SHA256 against X-Webhook-Signature
func VerifyAulaaSignature(rawBody []byte, signatureHeader string, webhookSecret string) bool {
	if len(rawBody) == 0 || strings.TrimSpace(signatureHeader) == "" || strings.TrimSpace(webhookSecret) == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(strings.TrimSpace(webhookSecret)))
	mac.Write(rawBody)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	cleanSignature := strings.ToLower(strings.TrimSpace(signatureHeader))
	cleanExpected := strings.ToLower(expectedSignature)

	return subtle.ConstantTimeCompare([]byte(cleanExpected), []byte(cleanSignature)) == 1
}

// CreateAulaaPayment initializes an online payment checkout on Aulaa.co
func CreateAulaaPayment(cfg AulaaConfig, req AulaaCreatePaymentRequest) (*AulaaCreatePaymentResponse, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("AULAA_API_KEY belum dikonfigurasi pada pengaturan platform")
	}

	endpoint := fmt.Sprintf("%s/payments", cfg.BaseURL)
	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menyusun payload request aulaa: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("gagal membuat http request ke aulaa: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: DefaultHTTPTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("koneksi ke api aulaa.co gagal: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca respon dari aulaa.co: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("aulaa api mengembalikan error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var paymentResp AulaaCreatePaymentResponse
	if err := json.Unmarshal(respBody, &paymentResp); err != nil {
		return nil, fmt.Errorf("gagal membedah json respon aulaa: %w (raw: %s)", err, string(respBody))
	}

	return &paymentResp, nil
}

// CheckAulaaPaymentStatus retrieves the latest payment state from Aulaa.co
func CheckAulaaPaymentStatus(cfg AulaaConfig, paymentID string) (*AulaaPaymentStatusResponse, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("AULAA_API_KEY belum dikonfigurasi")
	}
	cleanPaymentID := strings.TrimSpace(paymentID)
	if cleanPaymentID == "" {
		return nil, fmt.Errorf("paymentID kosong")
	}

	endpoint := fmt.Sprintf("%s/payments/%s", cfg.BaseURL, cleanPaymentID)
	httpReq, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request cek status: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: DefaultHTTPTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi aulaa: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca respon cek status aulaa: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("aulaa status api error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var statusResp AulaaPaymentStatusResponse
	if err := json.Unmarshal(respBody, &statusResp); err != nil {
		return nil, fmt.Errorf("gagal membedah respon status aulaa: %w", err)
	}

	return &statusResp, nil
}


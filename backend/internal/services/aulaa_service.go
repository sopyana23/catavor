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
	"net"
	"net/http"
	"net/url"
	"os"
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

// ValidateAulaaBaseURL validates an outbound Aulaa API base URL against SSRF vectors.
// It enforces HTTPS, rejects embedded credentials, and blocks loopback, private (RFC1918),
// link-local / cloud metadata (169.254.0.0/16), and internal hostnames unless
// AULAA_ALLOW_LOCAL_HTTP=true is explicitly set for local integration tests.
func ValidateAulaaBaseURL(rawURL string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(rawURL), "/")
	if trimmed == "" {
		return DefaultAulaaBaseURL, nil
	}

	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("format Base URL Aulaa tidak valid")
	}
	if u.User != nil {
		return "", fmt.Errorf("Base URL Aulaa tidak boleh memuat kredensial userinfo")
	}

	allowLocal := strings.EqualFold(strings.TrimSpace(os.Getenv("AULAA_ALLOW_LOCAL_HTTP")), "true")
	scheme := strings.ToLower(u.Scheme)
	if scheme != "https" && !(allowLocal && scheme == "http") {
		return "", fmt.Errorf("Base URL Aulaa wajib menggunakan protokol HTTPS")
	}

	host := strings.ToLower(u.Hostname())
	if host == "" {
		return "", fmt.Errorf("hostname Base URL Aulaa kosong")
	}

	if !allowLocal {
		if host == "localhost" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
			return "", fmt.Errorf("hostname lokal atau internal tidak diizinkan untuk Base URL Aulaa")
		}
		if ip := net.ParseIP(host); ip != nil {
			if isDisallowedAulaaIP(ip) {
				return "", fmt.Errorf("alamat IP privat, loopback, atau metadata tidak diizinkan untuk Base URL Aulaa")
			}
		} else if ips, lookupErr := net.LookupIP(host); lookupErr == nil {
			for _, resolvedIP := range ips {
				if isDisallowedAulaaIP(resolvedIP) {
					return "", fmt.Errorf("hostname Base URL Aulaa mengarah ke alamat IP internal/privat yang dilarang")
				}
			}
		}
	}

	return trimmed, nil
}

func isDisallowedAulaaIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() ||
		ip.IsUnspecified()
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
				if validURL, valErr := ValidateAulaaBaseURL(s.Value); valErr == nil && validURL != "" {
					cfg.BaseURL = validURL
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
	OrderID       string  `json:"order_id"`
	Amount        float64 `json:"amount"`
	RedirectURL   string  `json:"redirect_url,omitempty"`
	PaymentMethod string  `json:"payment_method,omitempty"`
}

// AulaaPaymentMethodFee represents transaction fee details for a payment method
type AulaaPaymentMethodFee struct {
	Flat    float64 `json:"flat"`
	Percent float64 `json:"percent"`
}

// AulaaPaymentMethodItem represents a payment method returned by GET /v1/payments/methods
type AulaaPaymentMethodItem struct {
	Code      string                 `json:"code"`
	Name      string                 `json:"name"`
	Type      string                 `json:"type"`
	MinAmount float64                `json:"min_amount,omitempty"`
	MaxAmount float64                `json:"max_amount,omitempty"`
	Fee       *AulaaPaymentMethodFee `json:"fee,omitempty"`
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

// GetAulaaPaymentMethods retrieves the list of active payment methods from GET /v1/payments/methods
func GetAulaaPaymentMethods(cfg AulaaConfig) ([]AulaaPaymentMethodItem, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("AULAA_API_KEY belum dikonfigurasi")
	}

	endpoint := fmt.Sprintf("%s/payments/methods", cfg.BaseURL)
	httpReq, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request metode pembayaran: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: DefaultHTTPTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi api aulaa.co: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca respon metode pembayaran aulaa: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("aulaa methods api error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Format response may be { "success": true, "data": [...] } or direct array [...]
	var envelope struct {
		Success bool                     `json:"success"`
		Message string                   `json:"message"`
		Data    []AulaaPaymentMethodItem `json:"data"`
	}
	if err := json.Unmarshal(respBody, &envelope); err == nil && len(envelope.Data) > 0 {
		return envelope.Data, nil
	}

	var directList []AulaaPaymentMethodItem
	if err := json.Unmarshal(respBody, &directList); err == nil {
		return directList, nil
	}

	return nil, fmt.Errorf("gagal membedah data metode pembayaran: raw response=%s", string(respBody))
}

// CancelAulaaPayment cancels an active pending payment via POST /v1/payments/{id}/cancel
func CancelAulaaPayment(cfg AulaaConfig, paymentID string) error {
	if cfg.APIKey == "" {
		return fmt.Errorf("AULAA_API_KEY belum dikonfigurasi")
	}
	cleanPaymentID := strings.TrimSpace(paymentID)
	if cleanPaymentID == "" {
		return fmt.Errorf("paymentID kosong")
	}

	endpoint := fmt.Sprintf("%s/payments/%s/cancel", cfg.BaseURL, cleanPaymentID)
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("gagal membuat request cancel payment: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: DefaultHTTPTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("gagal menghubungi aulaa: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("gagal membaca respon cancel aulaa: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("aulaa cancel api error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}



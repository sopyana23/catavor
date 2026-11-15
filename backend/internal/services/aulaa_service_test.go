package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestVerifyAulaaSignature(t *testing.T) {
	secret := "whsec_test_secret_key_12345"
	payload := []byte(`{"order_id":"INV-SUB-001","amount":50000,"status":"paid"}`)

	// Generate valid signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	validSignature := hex.EncodeToString(mac.Sum(nil))

	t.Run("valid signature should pass", func(t *testing.T) {
		if !VerifyAulaaSignature(payload, validSignature, secret) {
			t.Errorf("VerifyAulaaSignature failed for valid signature")
		}
	})

	t.Run("invalid signature should fail", func(t *testing.T) {
		if VerifyAulaaSignature(payload, "invalid_hex_signature", secret) {
			t.Errorf("VerifyAulaaSignature passed for invalid signature")
		}
	})

	t.Run("empty signature or secret should fail", func(t *testing.T) {
		if VerifyAulaaSignature(payload, "", secret) {
			t.Errorf("VerifyAulaaSignature passed with empty signature")
		}
		if VerifyAulaaSignature(payload, validSignature, "") {
			t.Errorf("VerifyAulaaSignature passed with empty secret")
		}
		if VerifyAulaaSignature(nil, validSignature, secret) {
			t.Errorf("VerifyAulaaSignature passed with nil payload")
		}
	})
}

func TestGetAulaaPaymentMethods(t *testing.T) {
	t.Run("empty API key returns error", func(t *testing.T) {
		cfg := AulaaConfig{APIKey: ""}
		_, err := GetAulaaPaymentMethods(cfg)
		if err == nil {
			t.Errorf("Expected error for empty API key, got nil")
		}
	})
}

func TestCancelAulaaPayment(t *testing.T) {
	t.Run("empty API key or paymentID returns error", func(t *testing.T) {
		cfg := AulaaConfig{APIKey: ""}
		if err := CancelAulaaPayment(cfg, "pay_123"); err == nil {
			t.Errorf("Expected error for empty API key")
		}

		cfg.APIKey = "pgw_id_test"
		if err := CancelAulaaPayment(cfg, ""); err == nil {
			t.Errorf("Expected error for empty paymentID")
		}
	})
}

// ---------------------------------------------------------------------------
// N-48 Anti-SSRF & Anti-DNS Rebinding Tests
// ---------------------------------------------------------------------------

func TestDisallowedAulaaIP_CompleteCIDR(t *testing.T) {
	disallowedCases := []struct {
		ipStr string
		label string
	}{
		{"0.0.0.0", "IPv4 unspecified"},
		{"0.0.0.1", "IPv4 This Network / localhost route in Linux"},
		{"0.255.255.255", "IPv4 This Network upper boundary"},
		{"127.0.0.1", "IPv4 loopback"},
		{"127.0.0.2", "IPv4 loopback secondary"},
		{"::1", "IPv6 loopback"},
		{"10.0.0.1", "RFC 1918 Class A"},
		{"10.254.0.1", "RFC 1918 Class A"},
		{"172.16.0.1", "RFC 1918 Class B"},
		{"172.31.255.255", "RFC 1918 Class B"},
		{"192.168.1.1", "RFC 1918 Class C"},
		{"192.168.254.254", "RFC 1918 Class C"},
		{"169.254.169.254", "IPv4 link-local cloud metadata"},
		{"169.254.1.1", "IPv4 link-local unicast"},
		{"100.64.0.1", "Carrier-Grade NAT (RFC 6598)"},
		{"100.127.255.254", "Carrier-Grade NAT upper boundary"},
		{"198.18.0.1", "Benchmark Testing (RFC 2544)"},
		{"198.19.255.254", "Benchmark Testing upper boundary"},
		{"240.0.0.1", "Class E Reserved (RFC 1112)"},
		{"255.255.255.255", "Limited Broadcast"},
		{"::ffff:127.0.0.1", "IPv4-mapped IPv6 loopback"},
		{"::ffff:169.254.169.254", "IPv4-mapped IPv6 link-local"},
		{"::ffff:10.0.0.1", "IPv4-mapped IPv6 private"},
		{"64:ff9b::127.0.0.1", "IPv6 NAT64 prefix (RFC 6052)"},
		{"64:ff9b:1::169.254.169.254", "IPv6 NAT64 local-use prefix (RFC 8215)"},
		{"fe80::1", "IPv6 link-local"},
		{"fc00::1", "IPv6 unique local"},
		{"fd00::1", "IPv6 unique local"},
	}

	for _, tc := range disallowedCases {
		ip := net.ParseIP(tc.ipStr)
		if ip == nil {
			t.Fatalf("failed to parse IP %q", tc.ipStr)
		}
		if !isDisallowedAulaaIP(ip) {
			t.Errorf("isDisallowedAulaaIP(%q) [%s] = false, want true (disallowed)", tc.ipStr, tc.label)
		}
	}

	allowedCases := []struct {
		ipStr string
		label string
	}{
		{"8.8.8.8", "Google Public DNS"},
		{"1.1.1.1", "Cloudflare DNS"},
		{"104.21.5.1", "Cloudflare CDN"},
		{"142.250.190.46", "Google Server"},
		{"2606:4700:4700::1111", "Cloudflare IPv6"},
	}

	for _, tc := range allowedCases {
		ip := net.ParseIP(tc.ipStr)
		if ip == nil {
			t.Fatalf("failed to parse IP %q", tc.ipStr)
		}
		if isDisallowedAulaaIP(ip) {
			t.Errorf("isDisallowedAulaaIP(%q) [%s] = true, want false (allowed)", tc.ipStr, tc.label)
		}
	}
}

// TestSafeAulaaHTTPClient_TOCTOUDNSRebinding: simulasi nyata TOCTOU DNS Rebinding.
// Host lolos saat pemeriksaan awal (ValidateAulaaBaseURL) karena meresolusi ke IP publik,
// namun saat DialContext resolver mengembalikan 169.254.169.254 (metadata cloud) -> WAJIB DITOLAK sebelum TCP dial.
func TestSafeAulaaHTTPClient_TOCTOUDNSRebinding(t *testing.T) {
	t.Setenv("AULAA_ALLOW_LOCAL_HTTP", "false")

	mockResolver := func(ctx context.Context, host string) ([]net.IPAddr, error) {
		// Mensimulasikan DNS Rebinding: mengembalikan IP cloud metadata saat dial berlangsung
		return []net.IPAddr{
			{IP: net.ParseIP("169.254.169.254")},
		}, nil
	}

	client := newSafeAulaaHTTPClientWithResolver(mockResolver)
	req, err := http.NewRequest(http.MethodGet, "https://api.aulaa.co/v1/payments/test", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	_, err = client.Do(req)
	if err == nil {
		t.Fatal("expected request to fail due to DNS rebinding to metadata IP, but got nil error")
	}

	if !strings.Contains(err.Error(), "SSRF guard") || !strings.Contains(err.Error(), "169.254.169.254") {
		t.Fatalf("expected SSRF guard error containing blocked IP, got: %v", err)
	}
}

// TestSafeAulaaHTTPClient_DualRecordPoisoning: resolver mengembalikan campuran record publik + internal
// [93.184.216.34, 127.0.0.1]. Sistem wajib menolak keras seluruh dial (anti dual-record DNS poisoning).
func TestSafeAulaaHTTPClient_DualRecordPoisoning(t *testing.T) {
	t.Setenv("AULAA_ALLOW_LOCAL_HTTP", "false")

	mockResolver := func(ctx context.Context, host string) ([]net.IPAddr, error) {
		return []net.IPAddr{
			{IP: net.ParseIP("93.184.216.34")},
			{IP: net.ParseIP("127.0.0.1")},
		}, nil
	}

	client := newSafeAulaaHTTPClientWithResolver(mockResolver)
	req, err := http.NewRequest(http.MethodGet, "https://api.aulaa.co/v1/payments/test", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	_, err = client.Do(req)
	if err == nil {
		t.Fatal("expected request to fail due to dual-record DNS poisoning, but got nil error")
	}

	if !strings.Contains(err.Error(), "SSRF guard") {
		t.Fatalf("expected SSRF guard error, got: %v", err)
	}
}

// TestSafeAulaaHTTPClient_MultiIPFailover: domain dual-stack mengembalikan [IP unreachable, IP server tes].
// Klien wajib mencoba IP kedua secara berurutan hingga berhasil terkoneksi tanpa kegagalan.
func TestSafeAulaaHTTPClient_MultiIPFailover(t *testing.T) {
	t.Setenv("AULAA_ALLOW_LOCAL_HTTP", "true")

	// Server lokal sebagai target kedua yang aktif
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer ts.Close()

	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("failed to parse test server URL: %v", err)
	}
	tsHost, tsPort, _ := net.SplitHostPort(u.Host)
	tsIP := net.ParseIP(tsHost)

	// Resolver mengembalikan IP pertama yang menolak koneksi (127.0.0.2 tidak ada listener), lalu IP server tes
	mockResolver := func(ctx context.Context, host string) ([]net.IPAddr, error) {
		return []net.IPAddr{
			{IP: net.ParseIP("127.0.0.2")}, // Langsung ditolak connection refused
			{IP: tsIP},                      // Target server lokal aktif
		}, nil
	}

	client := newSafeAulaaHTTPClientWithResolver(mockResolver)
	endpoint := fmt.Sprintf("http://api.aulaa.local:%s/v1/test", tsPort)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("expected failover to succeed, got error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200 after failover, got %d", resp.StatusCode)
	}
}

// TestSafeAulaaHTTPClient_RejectsRedirect: server merespon 302 Found ke URL lain.
// Klien wajib mengembalikan response 302 langsung tanpa mengikuti redirect (anti open-redirect SSRF).
func TestSafeAulaaHTTPClient_RejectsRedirect(t *testing.T) {
	t.Setenv("AULAA_ALLOW_LOCAL_HTTP", "true")

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusFound)
	}))
	defer ts.Close()

	client := newSafeAulaaHTTPClientWithResolver(nil)
	req, err := http.NewRequest(http.MethodGet, ts.URL, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("expected client to receive 302 response without error, got: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		t.Fatalf("expected status 302 (not followed), got %d", resp.StatusCode)
	}
}

// TestSafeAulaaHTTPClient_SchemeValidation: skema HTTP plaintext ditolak ketika AULAA_ALLOW_LOCAL_HTTP=false.
func TestSafeAulaaHTTPClient_SchemeValidation(t *testing.T) {
	t.Setenv("AULAA_ALLOW_LOCAL_HTTP", "false")

	cfg := AulaaConfig{
		BaseURL: "http://api.aulaa.co/v1",
		APIKey:  "key_test",
	}

	_, err := CreateAulaaPayment(cfg, AulaaCreatePaymentRequest{})
	if err == nil {
		t.Fatal("expected CreateAulaaPayment to fail for http:// URL when local http not allowed")
	}
	if !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("expected error mentioning HTTPS, got: %v", err)
	}

	_, err = CheckAulaaPaymentStatus(cfg, "pay_1")
	if err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("expected CheckAulaaPaymentStatus to reject non-HTTPS, got: %v", err)
	}

	_, err = GetAulaaPaymentMethods(cfg)
	if err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("expected GetAulaaPaymentMethods to reject non-HTTPS, got: %v", err)
	}

	err = CancelAulaaPayment(cfg, "pay_1")
	if err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("expected CancelAulaaPayment to reject non-HTTPS, got: %v", err)
	}
}

package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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


package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// SECURITY (M1-mitigasi): token JWT disimpan di localStorage sehingga bila
// tercuri (XSS) token dapat dipakai dari perangkat lain. Idealnya dipindah ke
// httpOnly cookie; sebelum itu, kita deteksi penyalahgunaan:
//
//   - IP dan User-Agent saat login dicatat (hash, bukan nilai mentah)
//   - bila token yang sama dipakai dari IP/UA berbeda, kejadian dicatat ke log
//     dengan level WARN agar bisa ditindaklanjuti (alert/monitoring)
//
// Sengaja TIDAK memblokir: pengguna mobile sering berganti IP (seluler ↔ WiFi),
// dan memblokir akan memaksa logout di tengah pekerjaan. Deteksi + audit trail
// memberi sinyal tanpa merusak UX.
//
// Dampak privasi: hanya hash SHA-256 dari "ip|ua" yang disimpan di memori,
// dengan TTL, sehingga tidak ada data pribadi mentah yang persist.

type sessionFingerprint struct {
	Hash      string
	FirstSeen time.Time
	LastSeen  time.Time
}

var (
	fingerprintMu    sync.RWMutex
	fingerprints     = map[string]*sessionFingerprint{} // key: jti
	fingerprintTTL   = 24 * time.Hour
	lastFingerprintSweep time.Time
)

// fingerprintClaims membuat hash dari IP + User-Agent.
func fingerprintClaims(ip, ua string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(ip)) + "|" + strings.ToLower(strings.TrimSpace(ua))))
	return hex.EncodeToString(sum[:])
}

// RegisterSessionFingerprint mencatat sidik jari sesi saat token diterbitkan.
// Dipanggil dari handler login setelah token dibuat.
func RegisterSessionFingerprint(jti, ip, ua string) {
	if jti == "" {
		return
	}
	now := time.Now()
	fingerprintMu.Lock()
	defer fingerprintMu.Unlock()

	fingerprints[jti] = &sessionFingerprint{
		Hash:      fingerprintClaims(ip, ua),
		FirstSeen: now,
		LastSeen:  now,
	}
	sweepFingerprintsLocked(now)
}

// CheckSessionFingerprint membandingkan sidik jari permintaan saat ini dengan
// yang tercatat saat login. Mengembalikan true bila cocok atau belum tercatat.
// Ketidakcocokan hanya dicatat (WARN) — tidak memblokir permintaan.
func CheckSessionFingerprint(c *fiber.Ctx, jti string, userID uint) bool {
	if jti == "" {
		return true
	}
	now := time.Now()
	current := fingerprintClaims(c.IP(), c.Get("User-Agent"))

	fingerprintMu.RLock()
	fp, ok := fingerprints[jti]
	var expected string
	if ok {
		expected = fp.Hash
	}
	fingerprintMu.RUnlock()

	if !ok {
		// Sesi lama (token diterbitkan sebelum fitur ini aktif) — catat saja.
		fingerprintMu.Lock()
		fingerprints[jti] = &sessionFingerprint{Hash: current, FirstSeen: now, LastSeen: now}
		fingerprintMu.Unlock()
		return true
	}

	fingerprintMu.Lock()
	if fpEntry, exists := fingerprints[jti]; exists {
		fpEntry.LastSeen = now
	}
	fingerprintMu.Unlock()

	if expected != current {
		log.Warn().
			Uint("user_id", userID).
			Str("jti", jti).
			Str("ip", c.IP()).
			Str("path", c.Path()).
			Str("ua_prefix", truncate(c.Get("User-Agent"), 60)).
			Msg("SESI ANOMALI: token dipakai dari IP/User-Agent berbeda dari saat login. " +
				"Bila bukan pengguna sah, token kemungkinan dicuri — pertimbangkan revoke sesi.")
		return false
	}
	return true
}

// RevokeSessionFingerprint menghapus catatan saat logout.
func RevokeSessionFingerprint(jti string) {
	if jti == "" {
		return
	}
	fingerprintMu.Lock()
	delete(fingerprints, jti)
	fingerprintMu.Unlock()
}

// sweepFingerprintsLocked membersihkan entri kedaluwarsa (dipanggil dengan lock).
func sweepFingerprintsLocked(now time.Time) {
	if now.Sub(lastFingerprintSweep) < 10*time.Minute {
		return
	}
	lastFingerprintSweep = now
	for jti, fp := range fingerprints {
		if now.Sub(fp.LastSeen) > fingerprintTTL {
			delete(fingerprints, jti)
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

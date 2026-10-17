package middleware

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
)

// inlineScriptRegex menangkap isi <script> tanpa atribut src (script inline).
var inlineScriptRegex = regexp.MustCompile(`(?is)<script(?:\s[^>]*)?>(.*?)</script>`)

// srcAttrRegex mendeteksi script yang punya atribut src (script eksternal,
// tidak perlu hash karena diizinkan lewat daftar host).
var srcAttrRegex = regexp.MustCompile(`(?i)\bsrc\s*=`)

var (
	cspHashOnce    sync.Once
	cspScriptHash  string
	cspHashBuilt   bool
	cspDistDirs    []string
	cspHashMu      sync.RWMutex
	cspLastBuildID string
)

// SetCSPDistDirs mendaftarkan direktori index.html yang perlu dihitung hash
// script inline-nya (desktop, tablet, mobile). Dipanggil sekali saat startup
// dari main.go. Setelah didaftarkan, hash dihitung lazy saat pertama diminta.
func SetCSPDistDirs(dirs ...string) {
	cspHashMu.Lock()
	defer cspHashMu.Unlock()
	cspDistDirs = dirs
	cspHashBuilt = false
}

// buildScriptHashes memindai index.html di setiap dist dir, menghitung
// SHA-256 untuk tiap script inline, lalu mengembalikan direktif CSP siap pakai
// (mis. "'sha256-abc...' 'sha256-def...' ").
//
// Keuntungan dibanding hardcode: hash selalu sinkron dengan file yang benar-benar
// disajikan, sehingga tidak jadi rapuh saat index.html diedit.
func buildScriptHashes() string {
	seen := map[string]bool{}
	var parts []string

	for _, dir := range cspDistDirs {
		if dir == "" {
			continue
		}
		indexPath := filepath.Join(dir, "index.html")
		data, err := os.ReadFile(indexPath)
		if err != nil {
			continue
		}
		matches := inlineScriptRegex.FindAllStringSubmatch(string(data), -1)
		for _, m := range matches {
			full := m[0]
			// Lewati script eksternal (punya atribut src).
			openTag := full[:strings.Index(full, ">")+1]
			if srcAttrRegex.MatchString(openTag) {
				continue
			}
			body := m[1]
			if strings.TrimSpace(body) == "" {
				continue
			}
			sum := sha256.Sum256([]byte(body))
			h := "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
			if !seen[h] {
				seen[h] = true
				parts = append(parts, h)
			}
		}
	}

	if len(parts) == 0 {
		return ""
	}
	log.Info().Int("hashes", len(parts)).Msg("CSP: hash script inline dihitung dari index.html")
	return strings.Join(parts, " ") + " "
}

// scriptSrcHashes mengembalikan direktif hash script inline (di-cache).
// String kosong berarti tidak ada script inline (CSP tanpa 'unsafe-inline').
func scriptSrcHashes() string {
	cspHashOnce.Do(func() {
		cspHashMu.RLock()
		dirs := append([]string(nil), cspDistDirs...)
		cspHashMu.RUnlock()
		if len(dirs) == 0 {
			// Default: lokasi standar relatif terhadap working dir server.
			dirs = []string{"public/desktop", "public/tablet", "public/mobile"}
		}
		cspDistDirs = dirs
		cspScriptHash = buildScriptHashes()
		cspHashBuilt = true
	})
	return cspScriptHash
}

// RefreshCSPHashes membangun ulang hash (mis. setelah deploy asset baru).
func RefreshCSPHashes() {
	cspHashMu.Lock()
	cspHashOnce = sync.Once{}
	cspHashBuilt = false
	cspHashMu.Unlock()
	scriptSrcHashes()
}

package middleware

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// inlineScriptRegex menangkap isi <script> tanpa atribut src (script inline).
var inlineScriptRegex = regexp.MustCompile(`(?is)<script(?:\s[^>]*)?>(.*?)</script>`)

// srcAttrRegex mendeteksi script yang punya atribut src (script eksternal,
// tidak perlu hash karena diizinkan lewat daftar host).
var srcAttrRegex = regexp.MustCompile(`(?i)\bsrc\s*=`)

var (
	cspHashMu     sync.RWMutex
	cspScriptHash string
	cspHashBuilt  bool
	cspDistDirs   []string
	cspLastMtimes = make(map[string]time.Time)
	cspLastCheck  time.Time
)

// SetCSPDistDirs mendaftarkan direktori index.html yang perlu dihitung hash
// script inline-nya (desktop, tablet, mobile). Dipanggil sekali saat startup
// dari main.go. Setelah didaftarkan, hash dihitung lazy saat pertama diminta.
func SetCSPDistDirs(dirs ...string) {
	cspHashMu.Lock()
	defer cspHashMu.Unlock()
	cspDistDirs = dirs
	cspHashBuilt = false
	cspScriptHash = ""
	cspLastMtimes = make(map[string]time.Time)
}

// buildScriptHashes memindai index.html di setiap dist dir, menghitung
// SHA-256 untuk tiap script inline, lalu mengembalikan direktif CSP siap pakai
// (mis. "'sha256-abc...' 'sha256-def...' ").
//
// Keuntungan dibanding hardcode: hash selalu sinkron dengan file yang benar-benar
// disajikan, sehingga tidak jadi rapuh saat index.html diedit.
func buildScriptHashes() string {
	hashes, _ := buildScriptHashesWithMtimes()
	return hashes
}

func buildScriptHashesWithMtimes() (string, map[string]time.Time) {
	seen := map[string]bool{}
	mtimes := make(map[string]time.Time)
	var parts []string

	for _, dir := range cspDistDirs {
		if dir == "" {
			continue
		}
		indexPath := filepath.Join(dir, "index.html")
		fi, err := os.Stat(indexPath)
		if err != nil {
			continue
		}
		mtimes[indexPath] = fi.ModTime()

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
		return "", mtimes
	}
	log.Info().Int("hashes", len(parts)).Msg("CSP: hash script inline dihitung dari index.html")
	return strings.Join(parts, " ") + " ", mtimes
}

// scriptSrcHashes mengembalikan direktif hash script inline (di-cache).
// String kosong berarti tidak ada script inline (CSP tanpa 'unsafe-inline').
// Secara otomatis mendeteksi perubahan berkas index.html di disk (auto-sync).
func scriptSrcHashes() string {
	cspHashMu.RLock()
	cached := cspScriptHash
	isBuilt := cspHashBuilt
	lastCheck := cspLastCheck
	cspHashMu.RUnlock()

	now := time.Now()
	// Debounce check berkas disk (2 detik) agar zero-overhead pada beban tinggi
	if isBuilt && now.Sub(lastCheck) < 2*time.Second {
		return cached
	}

	cspHashMu.Lock()
	defer cspHashMu.Unlock()

	if len(cspDistDirs) == 0 {
		cspDistDirs = []string{"public/desktop", "public/tablet", "public/mobile"}
	}

	needsRebuild := !cspHashBuilt || cspScriptHash == ""
	if !needsRebuild {
		for _, dir := range cspDistDirs {
			if dir == "" {
				continue
			}
			indexPath := filepath.Join(dir, "index.html")
			fi, err := os.Stat(indexPath)
			if err != nil {
				continue
			}
			if last, ok := cspLastMtimes[indexPath]; !ok || !fi.ModTime().Equal(last) {
				needsRebuild = true
				break
			}
		}
	}

	cspLastCheck = now
	if needsRebuild {
		hashes, mtimes := buildScriptHashesWithMtimes()
		cspScriptHash = hashes
		cspLastMtimes = mtimes
		cspHashBuilt = true
	}

	return cspScriptHash
}

// RefreshCSPHashes membangun ulang hash (mis. setelah deploy asset baru).
func RefreshCSPHashes() {
	cspHashMu.Lock()
	cspHashBuilt = false
	cspScriptHash = ""
	cspLastMtimes = make(map[string]time.Time)
	cspHashMu.Unlock()
	scriptSrcHashes()
}

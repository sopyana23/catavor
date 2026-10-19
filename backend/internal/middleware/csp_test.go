package middleware

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// hashOf menghitung direktif CSP yang diharapkan untuk isi script inline.
func hashOf(body string) string {
	sum := sha256.Sum256([]byte(body))
	return "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
}

func writeIndex(t *testing.T, dir, html string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("buat dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(html), 0o644); err != nil {
		t.Fatalf("tulis index.html: %v", err)
	}
}

// TestBuildScriptHashes: hanya script inline yang di-hash; script eksternal
// dan script kosong dilewati; duplikat tidak menghasilkan hash ganda.
func TestBuildScriptHashes(t *testing.T) {
	dir := t.TempDir()
	inline := `console.log("halo")`
	writeIndex(t, dir, `<html><head>`+
		`<script src="/assets/app.js"></script>`+
		`<script type="module" src="/assets/main.js"></script>`+
		`<script>`+inline+`</script>`+
		`<script>   </script>`+
		`<script>`+inline+`</script>`+
		`</head><body></body></html>`)

	SetCSPDistDirs(dir)
	RefreshCSPHashes()

	got := scriptSrcHashes()
	want := hashOf(inline) + " "
	if got != want {
		t.Fatalf("hash salah.\ndapat: %q\nharap: %q", got, want)
	}
	if strings.Count(got, "'sha256-") != 1 {
		t.Errorf("hash duplikat tidak di-dedupe: %q", got)
	}
}

// TestBuildScriptHashesMultiDir: hash dari beberapa dist dir digabung dan
// tetap unik antar direktori.
func TestBuildScriptHashesMultiDir(t *testing.T) {
	desktop := t.TempDir()
	mobile := t.TempDir()
	writeIndex(t, desktop, `<script>desktopInline()</script>`)
	writeIndex(t, mobile, `<script>mobileInline()</script>`)

	SetCSPDistDirs(desktop, "", mobile)
	RefreshCSPHashes()

	got := scriptSrcHashes()
	for _, body := range []string{"desktopInline()", "mobileInline()"} {
		if !strings.Contains(got, hashOf(body)) {
			t.Errorf("hash untuk %q tidak ada di %q", body, got)
		}
	}
	if strings.Count(got, "'sha256-") != 2 {
		t.Errorf("jumlah hash = %d, harus 2: %q", strings.Count(got, "'sha256-"), got)
	}
}

// TestScriptSrcHashesEmptyWhenNoInlineScript: tidak ada script inline berarti
// direktif kosong (CSP tanpa 'unsafe-inline').
func TestScriptSrcHashesEmptyWhenNoInlineScript(t *testing.T) {
	dir := t.TempDir()
	writeIndex(t, dir, `<html><head><script src="/a.js"></script></head></html>`)
	SetCSPDistDirs(dir)
	RefreshCSPHashes()

	if got := scriptSrcHashes(); got != "" {
		t.Fatalf("harus kosong, dapat %q", got)
	}
}

// TestScriptSrcHashesIgnoresMissingDir: direktori tidak ada tidak boleh panic
// dan tidak boleh menghentikan pemindaian dir lain.
func TestScriptSrcHashesIgnoresMissingDir(t *testing.T) {
	valid := t.TempDir()
	writeIndex(t, valid, `<script>validInline()</script>`)

	SetCSPDistDirs(filepath.Join(t.TempDir(), "tidak-ada"), valid)
	RefreshCSPHashes()

	got := scriptSrcHashes()
	if !strings.Contains(got, hashOf("validInline()")) {
		t.Fatalf("dir valid tidak dipindai: %q", got)
	}
}

// TestScriptSrcHashesDefaultDirsWhenUnset: tanpa registrasi, pemindaian
// memakai lokasi standar (public/{desktop,tablet,mobile}) relatif ke cwd.
func TestScriptSrcHashesDefaultDirsWhenUnset(t *testing.T) {
	SetCSPDistDirs()
	RefreshCSPHashes()
	// cwd saat uji = direktori paket, tidak punya public/ -> kosong, tanpa error.
	if got := scriptSrcHashes(); got != "" {
		t.Fatalf("harus kosong, dapat %q", got)
	}
}

// TestRefreshCSPHashesPicksUpChanges: index.html berubah -> hash harus
// dihitung ulang (bukan memakai cache lama).
func TestRefreshCSPHashesPicksUpChanges(t *testing.T) {
	dir := t.TempDir()
	writeIndex(t, dir, `<script>versiSatu()</script>`)
	SetCSPDistDirs(dir)
	RefreshCSPHashes()

	oldHash := scriptSrcHashes()
	if !strings.Contains(oldHash, hashOf("versiSatu()")) {
		t.Fatalf("hash awal salah: %q", oldHash)
	}

	writeIndex(t, dir, `<script>versiDua()</script>`)
	// Tanpa refresh, cache lama masih dipakai (bukti cache bekerja).
	if cached := scriptSrcHashes(); cached != oldHash {
		t.Errorf("cache tidak dipakai: %q", cached)
	}

	RefreshCSPHashes()
	newHash := scriptSrcHashes()
	if !strings.Contains(newHash, hashOf("versiDua()")) {
		t.Errorf("hash baru tidak muncul: %q", newHash)
	}
	if strings.Contains(newHash, hashOf("versiSatu()")) {
		t.Errorf("hash lama masih ada setelah refresh: %q", newHash)
	}
}

// TestCSPHeaderCarriesComputedHash membuktikan hash yang dihitung benar-benar
// masuk ke header Content-Security-Policy yang dikirim ke browser.
func TestCSPHeaderCarriesComputedHash(t *testing.T) {
	dir := t.TempDir()
	writeIndex(t, dir, `<script>bootstrapInline()</script>`)
	SetCSPDistDirs(dir)
	RefreshCSPHashes()

	app, cfg := newTestApp(t, "local")
	_ = cfg
	res := doGet(t, app, "/x", nil)
	if res.StatusCode != 200 {
		t.Fatalf("status = %d", res.StatusCode)
	}
	csp := res.Header.Get("Content-Security-Policy")
	if !strings.Contains(csp, hashOf("bootstrapInline()")) {
		t.Fatalf("hash tidak ada di header CSP: %q", csp)
	}
	scriptSrc := directive(csp, "script-src")
	if strings.Contains(scriptSrc, "unsafe-inline") || strings.Contains(scriptSrc, "unsafe-eval") {
		t.Fatalf("script-src masih memuat unsafe-*: %q", scriptSrc)
	}
}

// directive mengambil satu direktif CSP berdasarkan namanya.
func directive(csp, name string) string {
	for _, part := range strings.Split(csp, ";") {
		p := strings.TrimSpace(part)
		if strings.HasPrefix(p, name+" ") || p == name {
			return p
		}
	}
	return ""
}

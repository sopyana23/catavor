package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type stubHandlerDNSResolver struct {
	txtByHost   map[string][]string
	cnameByHost map[string]string
	ipsByHost   map[string][]string
}

func (s *stubHandlerDNSResolver) LookupTXT(_ context.Context, name string) ([]string, error) {
	if recs, ok := s.txtByHost[strings.ToLower(name)]; ok {
		return recs, nil
	}
	return nil, errors.New("no TXT record")
}

func (s *stubHandlerDNSResolver) LookupCNAME(_ context.Context, host string) (string, error) {
	if cname, ok := s.cnameByHost[strings.ToLower(host)]; ok {
		return cname, nil
	}
	return "", errors.New("no CNAME record")
}

func (s *stubHandlerDNSResolver) LookupHost(_ context.Context, host string) ([]string, error) {
	if ips, ok := s.ipsByHost[strings.ToLower(host)]; ok {
		return ips, nil
	}
	return nil, errors.New("no A record")
}

func seedCustomDomainPlans(t *testing.T, db *gorm.DB) {
	t.Helper()
	plans := []models.SubscriptionPlan{
		{Code: "free", Name: "Gratis", MaxItems: 10, HasCustomDomain: false, SortOrder: 1},
		{Code: "pro_starter", Name: "Pro Starter", MaxItems: 100, HasCustomDomain: false, SortOrder: 2},
		{Code: "pro_business", Name: "Pro Bisnis", MaxItems: 1000, HasCustomDomain: true, SortOrder: 3},
	}
	for _, p := range plans {
		if err := db.Where("code = ?", p.Code).FirstOrCreate(&p).Error; err != nil {
			t.Fatalf("seed plan %s: %v", p.Code, err)
		}
	}
}

func callWithHeaders(t *testing.T, app *fiber.App, method, target string, payload any, headers map[string]string) apiResp {
	t.Helper()
	var bodyReader io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		bodyReader = strings.NewReader(string(b))
	}
	req := httptest.NewRequest(method, target, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		if strings.EqualFold(k, "Host") {
			req.Host = v
		}
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test(%s %s): %v", method, target, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return apiResp{Status: resp.StatusCode, Body: out, Raw: string(raw), Headers: resp.Header}
}

func newCustomDomainTestApp(db *gorm.DB, resolver services.DomainDNSResolver, secret string) (*fiber.App, string) {
	cfg := testCfg()
	cfg.AppURL = "http://localhost:8000"
	cfg.PlatformDomains = []string{"catavor.com"}
	cfg.CustomDomainCNAMETarget = "cname.catavor.com"
	cfg.CustomDomainEdgeIP = "203.0.113.10"
	cfg.CustomDomainTLSAskSecret = secret

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	subHandler := NewSubscriptionHandler(db, cfg, resolver)

	authStub := func(c *fiber.Ctx) error {
		if sidRaw := strings.TrimSpace(c.Get("X-Test-Store-ID")); sidRaw != "" {
			if sid, err := strconv.ParseUint(sidRaw, 10, 64); err == nil {
				c.Locals("store_id", uint(sid))
			}
		}
		if uidRaw := strings.TrimSpace(c.Get("X-Test-User-ID")); uidRaw != "" {
			if uid, err := strconv.ParseUint(uidRaw, 10, 64); err == nil {
				c.Locals("user_id", uint(uid))
			}
		}
		return c.Next()
	}

	app.Post("/api/subscription/custom-domain", authStub, subHandler.UpdateCustomDomain)
	app.Post("/api/subscription/custom-domain/verify", authStub, subHandler.VerifyCustomDomain)
	app.Delete("/api/subscription/custom-domain", authStub, subHandler.RemoveCustomDomain)
	app.Get("/api/domain/resolve", subHandler.ResolveCustomDomain)
	app.Get("/internal/tls-ask", subHandler.CheckTLSAsk)
	return app, cfg.CustomDomainCNAMETarget
}

func TestCustomDomainLifecycle_Handlers(t *testing.T) {
	db := newTestDB(t)
	seedCustomDomainPlans(t, db)

	freeStore := models.Store{Slug: "toko-free", StoreTitle: "Toko Free", Plan: "free", PlanStatus: "active"}
	starterStore := models.Store{Slug: "toko-starter", StoreTitle: "Toko Starter", Plan: "pro_starter", PlanStatus: "active"}
	bizStore := models.Store{Slug: "toko-biz", StoreTitle: "Toko Biz", Plan: "pro_business", PlanStatus: "active"}
	otherBiz := models.Store{Slug: "toko-other", StoreTitle: "Toko Other", Plan: "pro_business", PlanStatus: "active"}
	mustCreate(t, db, &freeStore)
	mustCreate(t, db, &starterStore)
	mustCreate(t, db, &bizStore)
	mustCreate(t, db, &otherBiz)

	resolver := &stubHandlerDNSResolver{
		txtByHost:   map[string][]string{},
		cnameByHost: map[string]string{},
	}
	app, cnameTarget := newCustomDomainTestApp(db, resolver, "qa-tls-secret")

	// 1. Free & Pro Starter receive 403 PLAN_UPGRADE_REQUIRED
	for _, tc := range []struct {
		name    string
		storeID uint
	}{
		{"free", freeStore.ID},
		{"pro_starter", starterStore.ID},
	} {
		resp := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain",
			map[string]string{"custom_domain": "shop.umkmqa.com"},
			map[string]string{"X-Test-Store-ID": strconv.FormatUint(uint64(tc.storeID), 10)},
		)
		if resp.Status != http.StatusForbidden {
			t.Fatalf("%s status = %d, want 403 (%s)", tc.name, resp.Status, resp.Raw)
		}
		if resp.Body["code"] != "PLAN_UPGRADE_REQUIRED" {
			t.Fatalf("%s code = %v, want PLAN_UPGRADE_REQUIRED", tc.name, resp.Body["code"])
		}
	}

	bizHeaders := map[string]string{
		"X-Test-Store-ID": strconv.FormatUint(uint64(bizStore.ID), 10),
		"X-Test-User-ID":  "10",
	}

	// 2. Reject platform & IP domains on Business plan
	for _, bad := range []string{"catavor.com", "shop.catavor.com", "192.168.1.50", "localhost"} {
		resp := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain",
			map[string]string{"custom_domain": bad},
			bizHeaders,
		)
		if resp.Status != http.StatusBadRequest {
			t.Fatalf("bad domain %q status = %d, want 400 (%s)", bad, resp.Status, resp.Raw)
		}
		if resp.Body["code"] != "INVALID_DOMAIN" {
			t.Fatalf("bad domain %q code = %v, want INVALID_DOMAIN", bad, resp.Body["code"])
		}
	}

	// 3. Save valid domain -> pending + TXT token
	saveResp := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain",
		map[string]string{"custom_domain": "HTTPS://Shop.BrandQA.com/"},
		bizHeaders,
	)
	if saveResp.Status != http.StatusOK {
		t.Fatalf("save domain status = %d, want 200 (%s)", saveResp.Status, saveResp.Raw)
	}
	dataMap, _ := saveResp.Body["data"].(map[string]any)
	if dataMap["custom_domain"] != "shop.brandqa.com" || dataMap["custom_domain_status"] != "pending" {
		t.Fatalf("unexpected save payload: %#v", dataMap)
	}
	token, _ := dataMap["verification_token"].(string)
	if !strings.HasPrefix(token, "catavor-verify=") {
		t.Fatalf("expected catavor-verify= token, got %q (payload=%#v)", token, dataMap)
	}

	// 4. Duplicate claim by another store returns 409
	dupResp := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain",
		map[string]string{"custom_domain": "shop.brandqa.com"},
		map[string]string{"X-Test-Store-ID": strconv.FormatUint(uint64(otherBiz.ID), 10)},
	)
	if dupResp.Status != http.StatusConflict || dupResp.Body["code"] != "DOMAIN_ALREADY_TAKEN" {
		t.Fatalf("duplicate claim = %d / %v, want 409 DOMAIN_ALREADY_TAKEN (%s)", dupResp.Status, dupResp.Body["code"], dupResp.Raw)
	}

	// 5. Verify fails (422) before DNS records exist
	failVerify := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain/verify", nil, bizHeaders)
	if failVerify.Status != http.StatusUnprocessableEntity {
		t.Fatalf("verify without DNS status = %d, want 422 (%s)", failVerify.Status, failVerify.Raw)
	}

	// 6. Seed matching TXT + CNAME -> verify succeeds (200 active)
	resolver.txtByHost["_catavor-verify.shop.brandqa.com"] = []string{token}
	resolver.cnameByHost["shop.brandqa.com"] = cnameTarget
	okVerify := callWithHeaders(t, app, "POST", "/api/subscription/custom-domain/verify", nil, bizHeaders)
	if okVerify.Status != http.StatusOK {
		t.Fatalf("verify with DNS status = %d, want 200 (%s)", okVerify.Status, okVerify.Raw)
	}
	okData, _ := okVerify.Body["data"].(map[string]any)
	if okData["custom_domain_status"] != "active" {
		t.Fatalf("expected custom_domain_status=active, got %v", okData["custom_domain_status"])
	}

	// 7. ResolveCustomDomain endpoint
	platRes := callWithHeaders(t, app, "GET", "/api/domain/resolve", nil, map[string]string{"Host": "catavor.com"})
	if platRes.Status != http.StatusOK || platRes.Body["is_custom_domain"] != false {
		t.Fatalf("platform resolve = %d / %#v", platRes.Status, platRes.Body)
	}
	custRes := callWithHeaders(t, app, "GET", "/api/domain/resolve", nil, map[string]string{"Host": "shop.brandqa.com"})
	if custRes.Status != http.StatusOK || custRes.Body["is_custom_domain"] != true {
		t.Fatalf("active custom resolve = %d / %s", custRes.Status, custRes.Raw)
	}
	unkRes := callWithHeaders(t, app, "GET", "/api/domain/resolve", nil, map[string]string{"Host": "unknown.example.com"})
	if unkRes.Status != http.StatusNotFound {
		t.Fatalf("unknown host resolve = %d, want 404", unkRes.Status)
	}

	// 8. CheckTLSAsk blocks spoofed non-loopback app.Test even with X-Forwarded-For
	spoofAsk := callWithHeaders(t, app, "GET", "/internal/tls-ask?domain=shop.brandqa.com", nil, map[string]string{
		"X-Forwarded-For":  "127.0.0.1",
		"X-TLS-Ask-Secret": "qa-tls-secret",
	})
	if spoofAsk.Status != http.StatusForbidden {
		t.Fatalf("spoofed tls-ask status = %d, want 403", spoofAsk.Status)
	}

	// 9. CheckTLSAsk authorizes real loopback TCP peer with valid secret, rejects bad secret & unknown domain
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	go func() { _ = app.Listener(ln) }()
	defer func() { _ = app.Shutdown() }()

	baseURL := "http://" + ln.Addr().String()
	httpClient := &http.Client{}

	reqOK, _ := http.NewRequest("GET", baseURL+"/internal/tls-ask?domain=shop.brandqa.com", nil)
	reqOK.Header.Set("X-TLS-Ask-Secret", "qa-tls-secret")
	respOK, err := httpClient.Do(reqOK)
	if err != nil {
		t.Fatalf("tls-ask loopback GET: %v", err)
	}
	respOK.Body.Close()
	if respOK.StatusCode != http.StatusOK {
		t.Fatalf("tls-ask active domain status = %d, want 200", respOK.StatusCode)
	}

	reqWrongSec, _ := http.NewRequest("GET", baseURL+"/internal/tls-ask?domain=shop.brandqa.com", nil)
	reqWrongSec.Header.Set("X-TLS-Ask-Secret", "wrong")
	respWrongSec, err := httpClient.Do(reqWrongSec)
	if err != nil {
		t.Fatalf("tls-ask wrong secret GET: %v", err)
	}
	respWrongSec.Body.Close()
	if respWrongSec.StatusCode != http.StatusForbidden {
		t.Fatalf("tls-ask wrong secret status = %d, want 403", respWrongSec.StatusCode)
	}

	reqUnk, _ := http.NewRequest("GET", baseURL+"/internal/tls-ask?domain=rogue.example.com", nil)
	reqUnk.Header.Set("X-TLS-Ask-Secret", "qa-tls-secret")
	respUnk, err := httpClient.Do(reqUnk)
	if err != nil {
		t.Fatalf("tls-ask unknown GET: %v", err)
	}
	respUnk.Body.Close()
	if respUnk.StatusCode != http.StatusForbidden {
		t.Fatalf("tls-ask unknown domain status = %d, want 403", respUnk.StatusCode)
	}

	// 10. RemoveCustomDomain clears active domain
	delResp := callWithHeaders(t, app, "DELETE", "/api/subscription/custom-domain", nil, bizHeaders)
	if delResp.Status != http.StatusOK {
		t.Fatalf("delete custom domain status = %d, want 200 (%s)", delResp.Status, delResp.Raw)
	}
	delData, _ := delResp.Body["data"].(map[string]any)
	if delData["custom_domain_status"] != "none" || delData["custom_domain"] != nil {
		t.Fatalf("expected cleared domain state, got %#v", delData)
	}
}

func TestSPAHandler_CustomDomainMetaAndRedirects(t *testing.T) {
	db := newTestDB(t)
	seedCustomDomainPlans(t, db)

	domain := "toko-spa.example.com"
	mustCreate(t, db, &models.Store{
		Slug:               "spa-store",
		StoreTitle:         "SPA Store",
		Plan:               "pro_business",
		PlanStatus:         "active",
		CustomDomain:       &domain,
		CustomDomainStatus: "active",
	})

	distDir := t.TempDir()
	indexHTML := `<!doctype html><html><head><title>Catavor</title></head><body><div id="root"></div></body></html>`
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte(indexHTML), 0644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	cfg := testCfg()
	cfg.AppURL = "https://catavor.com"
	cfg.PlatformDomains = []string{"catavor.com"}
	cfg.DesktopDistDir = distDir
	cfg.MobileDistDir = distDir
	cfg.TabletDistDir = distDir

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	spa := NewSPAHandler(cfg, db)
	app.Use(spa.ServeSPA)

	// 1. Active custom domain / injects meta tags + canonical link
	rootResp := callWithHeaders(t, app, "GET", "/", nil, map[string]string{"Host": "toko-spa.example.com"})
	if rootResp.Status != http.StatusOK {
		t.Fatalf("custom host / status = %d, want 200", rootResp.Status)
	}
	for _, want := range []string{
		`<meta name="catavor-custom-domain" content="toko-spa.example.com" />`,
		`<meta name="catavor-custom-domain-slug" content="spa-store" />`,
		`<link rel="canonical" href="https://toko-spa.example.com/" />`,
	} {
		if !strings.Contains(rootResp.Raw, want) {
			t.Fatalf("expected HTML to contain %q, got:\n%s", want, rootResp.Raw)
		}
	}

	// 2. /admin on active custom host redirects 302 to canonical /<slug>/admin
	adminResp := callWithHeaders(t, app, "GET", "/admin?tab=settings", nil, map[string]string{"Host": "toko-spa.example.com"})
	if adminResp.Status != http.StatusFound {
		t.Fatalf("custom host /admin status = %d, want 302", adminResp.Status)
	}
	if loc := adminResp.Headers.Get("Location"); loc != "https://catavor.com/spa-store/admin?tab=settings" {
		t.Fatalf("/admin redirect Location = %q, want canonical admin URL", loc)
	}

	// 3. /login on custom host redirects 302 to canonical /login
	loginResp := callWithHeaders(t, app, "GET", "/login", nil, map[string]string{"Host": "toko-spa.example.com"})
	if loginResp.Status != http.StatusFound {
		t.Fatalf("custom host /login status = %d, want 302", loginResp.Status)
	}
	if loc := loginResp.Headers.Get("Location"); loc != "https://catavor.com/login" {
		t.Fatalf("/login redirect Location = %q", loc)
	}

	// 4. Unknown custom host returns 404 HTML page
	unkResp := callWithHeaders(t, app, "GET", "/", nil, map[string]string{"Host": "unregistered.example.com"})
	if unkResp.Status != http.StatusNotFound {
		t.Fatalf("unknown host / status = %d, want 404", unkResp.Status)
	}
}

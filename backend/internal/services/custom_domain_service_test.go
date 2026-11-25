package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type mockDomainDNSResolver struct {
	txtByHost   map[string][]string
	cnameByHost map[string]string
	ipsByHost   map[string][]string
	txtErr      error
	cnameErr    error
	hostErr     error
}

func (m *mockDomainDNSResolver) LookupTXT(_ context.Context, name string) ([]string, error) {
	if m.txtErr != nil {
		return nil, m.txtErr
	}
	if recs, ok := m.txtByHost[strings.ToLower(name)]; ok {
		return recs, nil
	}
	return nil, errors.New("no TXT record")
}

func (m *mockDomainDNSResolver) LookupCNAME(_ context.Context, host string) (string, error) {
	if m.cnameErr != nil {
		return "", m.cnameErr
	}
	if cname, ok := m.cnameByHost[strings.ToLower(host)]; ok {
		return cname, nil
	}
	return "", errors.New("no CNAME record")
}

func (m *mockDomainDNSResolver) LookupHost(_ context.Context, host string) ([]string, error) {
	if m.hostErr != nil {
		return nil, m.hostErr
	}
	if ips, ok := m.ipsByHost[strings.ToLower(host)]; ok {
		return ips, nil
	}
	return nil, errors.New("no A/AAAA record")
}

func setupCustomDomainServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_", "-", "_").Replace(t.Name())
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", name)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("gorm.Open(sqlite): %v", err)
	}
	if err := db.AutoMigrate(&models.SubscriptionPlan{}, &models.Store{}); err != nil {
		t.Fatalf("AutoMigrate(sqlite): %v", err)
	}

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
	return db
}

func TestStripHostPortAndDot(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"HTTPS://Shop.Brand.COM:8443/path?x=1", "shop.brand.com"},
		{"http://toko-qa.example.com./", "toko-qa.example.com"},
		{"[::1]:8000", "::1"},
		{"  brand.co.id.  ", "brand.co.id"},
	}
	for _, tc := range cases {
		if got := StripHostPortAndDot(tc.in); got != tc.want {
			t.Errorf("StripHostPortAndDot(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestIsPlatformHost(t *testing.T) {
	cfg := &config.Config{
		AppURL:          "https://app.catavor.com:443",
		PlatformDomains: []string{"staging.catavor.id"},
	}
	mustPlatform := []string{
		"",
		"catavor.com",
		"www.catavor.com",
		"shop.catavor.com",
		"app.catavor.com",
		"staging.catavor.id",
		"tenant.staging.catavor.id",
		"localhost",
		"localhost:8000",
		"127.0.0.1:8000",
		"::1",
	}
	for _, h := range mustPlatform {
		if !IsPlatformHost(h, cfg) {
			t.Errorf("IsPlatformHost(%q) = false, want true", h)
		}
	}

	nonPlatform := []string{
		"toko-qa.example.com",
		"shop.brand.co.id",
		"catavor-clone.com",
	}
	for _, h := range nonPlatform {
		if IsPlatformHost(h, cfg) {
			t.Errorf("IsPlatformHost(%q) = true, want false", h)
		}
	}
}

func TestNormalizeAndValidateCustomDomain(t *testing.T) {
	cfg := &config.Config{
		AppURL:          "https://catavor.com",
		PlatformDomains: []string{"catavor.com"},
	}

	validCases := []struct {
		in   string
		want string
	}{
		{"https://Shop.Brand.COM/", "shop.brand.com"},
		{"toko-satwa.co.id.", "toko-satwa.co.id"},
		{"katalog.umkm-nusantara.id", "katalog.umkm-nusantara.id"},
	}
	for _, tc := range validCases {
		got, err := NormalizeAndValidateCustomDomain(tc.in, cfg)
		if err != nil {
			t.Fatalf("NormalizeAndValidateCustomDomain(%q) unexpected err: %v", tc.in, err)
		}
		if got != tc.want {
			t.Errorf("NormalizeAndValidateCustomDomain(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}

	invalidInputs := []string{
		"",
		"   ",
		"a.b",
		"brand.com/admin",
		"user@brand.com",
		"bad_label.brand.com",
		"-startdash.com",
		"192.168.1.10",
		"127.0.0.1",
		"shop.local",
		"test.localhost",
		"internal.internal",
		"brand.123",
		"catavor.com",
		"shop.catavor.com",
		"www.catavor.com",
		"localhost",
	}
	for _, in := range invalidInputs {
		if got, err := NormalizeAndValidateCustomDomain(in, cfg); err == nil {
			t.Errorf("NormalizeAndValidateCustomDomain(%q) = %q, nil; want error", in, got)
		}
	}
}

func TestIsApexDomainAndBuildTXTHost(t *testing.T) {
	cases := []struct {
		domain     string
		wantApex   bool
		wantTXT    string
		wantFull   string
	}{
		{"brand.com", true, "_catavor-verify", "_catavor-verify.brand.com"},
		{"brand.co.id", true, "_catavor-verify", "_catavor-verify.brand.co.id"},
		{"shop.brand.com", false, "_catavor-verify.shop", "_catavor-verify.shop.brand.com"},
		{"katalog.brand.co.id", false, "_catavor-verify.katalog", "_catavor-verify.katalog.brand.co.id"},
		{"v2.shop.brand.com", false, "_catavor-verify.v2.shop", "_catavor-verify.v2.shop.brand.com"},
	}
	for _, tc := range cases {
		if gotApex := IsApexDomain(tc.domain); gotApex != tc.wantApex {
			t.Errorf("IsApexDomain(%q) = %v, want %v", tc.domain, gotApex, tc.wantApex)
		}
		if gotTXT := BuildCustomDomainTXTHost(tc.domain); gotTXT != tc.wantTXT {
			t.Errorf("BuildCustomDomainTXTHost(%q) = %q, want %q", tc.domain, gotTXT, tc.wantTXT)
		}
		if gotFull := BuildCustomDomainTXTFullHost(tc.domain); gotFull != tc.wantFull {
			t.Errorf("BuildCustomDomainTXTFullHost(%q) = %q, want %q", tc.domain, gotFull, tc.wantFull)
		}
	}
}

func TestGenerateDomainVerificationToken(t *testing.T) {
	t1, err := GenerateDomainVerificationToken()
	if err != nil {
		t.Fatalf("GenerateDomainVerificationToken err: %v", err)
	}
	t2, err := GenerateDomainVerificationToken()
	if err != nil {
		t.Fatalf("GenerateDomainVerificationToken err: %v", err)
	}
	if !strings.HasPrefix(t1, "catavor-verify=") || len(t1) < 30 {
		t.Fatalf("unexpected token format: %q", t1)
	}
	if t1 == t2 {
		t.Fatalf("expected cryptographically distinct tokens, got identical %q", t1)
	}
}

func TestVerifyCustomDomainDNS(t *testing.T) {
	token := "catavor-verify=abcdef0123456789"

	// 1. Subdomain verified via _catavor-verify TXT + exact CNAME
	res := VerifyCustomDomainDNS(context.Background(), "shop.brand.com", token, "cname.catavor.com", "203.0.113.10", &mockDomainDNSResolver{
		txtByHost: map[string][]string{
			"_catavor-verify.shop.brand.com": {token},
		},
		cnameByHost: map[string]string{
			"shop.brand.com": "cname.catavor.com.",
		},
	})
	if !res.Verified || !res.OwnershipVerified || !res.RoutingVerified {
		t.Fatalf("expected CNAME verification to pass, got %+v", res)
	}

	// 2. Apex domain verified via apex TXT fallback + Edge IP A-record match
	resApex := VerifyCustomDomainDNS(context.Background(), "brand.com", token, "cname.catavor.com", "203.0.113.10", &mockDomainDNSResolver{
		txtByHost: map[string][]string{
			"brand.com": {token},
		},
		ipsByHost: map[string][]string{
			"brand.com": {"203.0.113.10"},
		},
	})
	if !resApex.Verified || !resApex.OwnershipVerified || !resApex.RoutingVerified {
		t.Fatalf("expected Apex EdgeIP verification to pass, got %+v", resApex)
	}

	// 3. Ownership present but wrong CNAME and non-matching IP -> Routing fails with diagnostic message
	resWrongRoute := VerifyCustomDomainDNS(context.Background(), "shop.brand.com", token, "cname.catavor.com", "203.0.113.10", &mockDomainDNSResolver{
		txtByHost: map[string][]string{
			"_catavor-verify.shop.brand.com": {token},
		},
		cnameByHost: map[string]string{
			"shop.brand.com": "other.provider.net",
		},
		ipsByHost: map[string][]string{
			"shop.brand.com": {"198.51.100.44"},
		},
	})
	if resWrongRoute.Verified || !resWrongRoute.OwnershipVerified || resWrongRoute.RoutingVerified {
		t.Fatalf("expected ownership=true, routing=false, got %+v", resWrongRoute)
	}
	if resWrongRoute.ErrorMessage == "" {
		t.Fatalf("expected non-empty ErrorMessage when routing fails")
	}

	// 4. Missing TXT fails even when routing matches
	resNoTXT := VerifyCustomDomainDNS(context.Background(), "shop.brand.com", token, "cname.catavor.com", "", &mockDomainDNSResolver{
		cnameByHost: map[string]string{
			"shop.brand.com": "cname.catavor.com",
		},
	})
	if resNoTXT.Verified || resNoTXT.OwnershipVerified || !resNoTXT.RoutingVerified {
		t.Fatalf("expected ownership=false, routing=true, got %+v", resNoTXT)
	}
}

func TestResolveActiveStoreByCustomDomainAndTLSAsk(t *testing.T) {
	db := setupCustomDomainServiceTestDB(t)
	cfg := &config.Config{AppURL: "https://catavor.com", PlatformDomains: []string{"catavor.com"}}

	now := time.Now().UTC()
	dActive := "toko-aktif.example.com"
	dPending := "toko-pending.example.com"
	dVerifying := "toko-verifying.example.com"
	dFailed := "toko-failed.example.com"
	dFree := "toko-free.example.com"
	dBanned := "toko-banned.example.com"
	dExpired := "toko-expired.example.com"

	stores := []models.Store{
		{Slug: "s-active", StoreTitle: "Toko Aktif", Plan: "pro_business", PlanStatus: "active", CustomDomain: &dActive, CustomDomainStatus: "active", CustomDomainVerifiedAt: &now},
		{Slug: "s-pending", StoreTitle: "Toko Pending", Plan: "pro_business", PlanStatus: "active", CustomDomain: &dPending, CustomDomainStatus: "pending"},
		{Slug: "s-verifying", StoreTitle: "Toko Verifying", Plan: "pro_business", PlanStatus: "active", CustomDomain: &dVerifying, CustomDomainStatus: "verifying"},
		{Slug: "s-failed", StoreTitle: "Toko Failed", Plan: "pro_business", PlanStatus: "active", CustomDomain: &dFailed, CustomDomainStatus: "failed"},
		{Slug: "s-free", StoreTitle: "Toko Free", Plan: "free", PlanStatus: "active", CustomDomain: &dFree, CustomDomainStatus: "active"},
		{Slug: "s-banned", StoreTitle: "Toko Banned", Plan: "pro_business", PlanStatus: "active", DormancyStatus: "banned", CustomDomain: &dBanned, CustomDomainStatus: "active"},
		{Slug: "s-expired", StoreTitle: "Toko Expired", Plan: "pro_business", PlanStatus: "expired", CustomDomain: &dExpired, CustomDomainStatus: "active"},
	}
	for i := range stores {
		if err := db.Create(&stores[i]).Error; err != nil {
			t.Fatalf("seed store %s: %v", stores[i].Slug, err)
		}
	}

	resolved, err := ResolveActiveStoreByCustomDomain(db, cfg, "TOKO-AKTIF.example.com:443")
	if err != nil {
		t.Fatalf("ResolveActiveStoreByCustomDomain err: %v", err)
	}
	if resolved == nil || resolved.StoreSlug != "s-active" {
		t.Fatalf("expected active store s-active, got %+v", resolved)
	}

	if resPlat, err := ResolveActiveStoreByCustomDomain(db, cfg, "catavor.com"); err != nil || resPlat != nil {
		t.Fatalf("platform host should resolve nil, nil; got %+v, %v", resPlat, err)
	}

	shouldNotResolve := []string{dPending, dVerifying, dFailed, dFree, dBanned, dExpired, "unknown.example.com"}
	for _, h := range shouldNotResolve {
		if r, err := ResolveActiveStoreByCustomDomain(db, cfg, h); err != nil || r != nil {
			t.Errorf("host %q should not resolve as active store, got %+v (err=%v)", h, r, err)
		}
	}

	if !IsAllowedForTLSAsk(db, cfg, dActive) {
		t.Errorf("expected IsAllowedForTLSAsk(%q) = true", dActive)
	}
	if !IsAllowedForTLSAsk(db, cfg, dVerifying) {
		t.Errorf("expected IsAllowedForTLSAsk(%q) = true", dVerifying)
	}
	shouldRejectTLS := []string{dPending, dFailed, dFree, dBanned, dExpired, "catavor.com", "127.0.0.1", "unknown.example.com", ""}
	for _, h := range shouldRejectTLS {
		if IsAllowedForTLSAsk(db, cfg, h) {
			t.Errorf("expected IsAllowedForTLSAsk(%q) = false", h)
		}
	}
}

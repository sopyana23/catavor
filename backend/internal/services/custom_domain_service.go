package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

// DomainDNSResolver abstracts DNS lookups so unit tests can mock TXT, CNAME, and A/AAAA queries deterministically.
type DomainDNSResolver interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
	LookupCNAME(ctx context.Context, host string) (string, error)
	LookupHost(ctx context.Context, host string) ([]string, error)
}

// DefaultDomainDNSResolver queries live DNS via net.DefaultResolver with a bounded timeout.
type DefaultDomainDNSResolver struct {
	Timeout time.Duration
}

func (r DefaultDomainDNSResolver) resolverTimeout() time.Duration {
	if r.Timeout > 0 {
		return r.Timeout
	}
	return 5 * time.Second
}

func (r DefaultDomainDNSResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	cctx, cancel := context.WithTimeout(ctx, r.resolverTimeout())
	defer cancel()
	return net.DefaultResolver.LookupTXT(cctx, name)
}

func (r DefaultDomainDNSResolver) LookupCNAME(ctx context.Context, host string) (string, error) {
	cctx, cancel := context.WithTimeout(ctx, r.resolverTimeout())
	defer cancel()
	return net.DefaultResolver.LookupCNAME(cctx, host)
}

func (r DefaultDomainDNSResolver) LookupHost(ctx context.Context, host string) ([]string, error) {
	cctx, cancel := context.WithTimeout(ctx, r.resolverTimeout())
	defer cancel()
	return net.DefaultResolver.LookupHost(cctx, host)
}

var dnsLabelRegex = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

var multiPartPublicSuffixes = map[string]bool{
	"co.id": true, "or.id": true, "ac.id": true, "web.id": true, "my.id": true, "biz.id": true, "sch.id": true, "go.id": true, "net.id": true,
	"co.uk": true, "org.uk": true, "me.uk": true,
	"com.sg": true, "com.my": true, "com.au": true, "co.jp": true,
}

var reservedTLDs = map[string]bool{
	"local":     true,
	"localhost": true,
	"internal":  true,
	"lan":       true,
	"home":      true,
	"arpa":      true,
	"test":      true,
	"invalid":   true,
	"onion":     true,
}

// EffectivePlatformDomains returns normalized platform hostnames built from config plus canonical defaults.
func EffectivePlatformDomains(cfg *config.Config) []string {
	seen := map[string]bool{}
	var out []string
	add := func(raw string) {
		h := StripHostPortAndDot(raw)
		if h != "" && !seen[h] {
			seen[h] = true
			out = append(out, h)
		}
	}

	for _, d := range []string{"catavor.com", "www.catavor.com", "localhost", "127.0.0.1", "::1"} {
		add(d)
	}
	if cfg != nil {
		if u, err := url.Parse(strings.TrimSpace(cfg.AppURL)); err == nil && u.Host != "" {
			add(u.Host)
		}
		for _, p := range cfg.PlatformDomains {
			add(p)
		}
	}
	return out
}

// StripHostPortAndDot normalizes a Host header / domain string without scheme, port, or trailing dot.
func StripHostPortAndDot(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimSuffix(s, "/")
	if idx := strings.IndexAny(s, "/?#"); idx >= 0 {
		s = s[:idx]
	}
	if h, _, err := net.SplitHostPort(s); err == nil {
		s = h
	} else if strings.HasPrefix(s, "[") && strings.HasSuffix(s, "]") {
		s = strings.TrimSuffix(strings.TrimPrefix(s, "["), "]")
	} else if strings.Count(s, ":") == 1 {
		if idx := strings.Index(s, ":"); idx >= 0 {
			s = s[:idx]
		}
	}
	return strings.TrimSuffix(s, ".")
}

// IsPlatformHost reports whether rawHost belongs to the platform itself (or loopback dev host).
func IsPlatformHost(rawHost string, cfg *config.Config) bool {
	host := StripHostPortAndDot(rawHost)
	if host == "" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return true
	}
	for _, p := range EffectivePlatformDomains(cfg) {
		if host == p {
			return true
		}
		// Match subdomains of real platform domains (e.g. *.catavor.com), skipping IP literals
		if net.ParseIP(p) == nil && p != "localhost" && strings.HasSuffix(host, "."+p) {
			return true
		}
	}
	return false
}

// NormalizeAndValidateCustomDomain enforces strict RFC 1035/1123 hostname rules and rejects platform hijacking or IP literals.
func NormalizeAndValidateCustomDomain(raw string, cfg *config.Config) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", errors.New("nama domain tidak boleh kosong")
	}
	trimmed = strings.TrimPrefix(trimmed, "https://")
	trimmed = strings.TrimPrefix(trimmed, "http://")
	trimmed = strings.TrimRight(trimmed, "/")
	trimmed = strings.TrimSuffix(trimmed, ".")

	if strings.ContainsAny(trimmed, " \t\r\n/?#@:*_\\") {
		return "", errors.New("format domain tidak valid; masukkan hanya nama domain tanpa protokol, path, atau karakter khusus")
	}
	if len(trimmed) < 4 || len(trimmed) > 253 {
		return "", errors.New("panjang nama domain harus antara 4 hingga 253 karakter")
	}
	if net.ParseIP(trimmed) != nil {
		return "", errors.New("alamat IP tidak diizinkan sebagai custom domain; gunakan nama domain yang valid")
	}

	labels := strings.Split(trimmed, ".")
	if len(labels) < 2 {
		return "", errors.New("nama domain harus menyertakan ekstensi TLD yang valid (contoh: brandanda.com)")
	}
	for _, lbl := range labels {
		if !dnsLabelRegex.MatchString(lbl) {
			return "", fmt.Errorf("bagian domain %q tidak memenuhi standar hostname RFC", lbl)
		}
	}
	tld := labels[len(labels)-1]
	if len(tld) < 2 || reservedTLDs[tld] {
		return "", fmt.Errorf("ekstensi domain .%s tidak didukung untuk akses publik", tld)
	}
	isNumeric := true
	for _, ch := range tld {
		if ch < '0' || ch > '9' {
			isNumeric = false
			break
		}
	}
	if isNumeric {
		return "", errors.New("TLD domain tidak valid")
	}

	if IsPlatformHost(trimmed, cfg) {
		return "", errors.New("domain milik platform Catavor atau host lokal tidak dapat diklaim sebagai custom domain")
	}
	return trimmed, nil
}

// IsApexDomain reports whether the normalized domain is an apex/root domain (e.g., brand.com or brand.co.id).
func IsApexDomain(domain string) bool {
	labels := strings.Split(StripHostPortAndDot(domain), ".")
	if len(labels) <= 2 {
		return len(labels) == 2
	}
	if len(labels) == 3 {
		lastTwo := labels[1] + "." + labels[2]
		return multiPartPublicSuffixes[lastTwo]
	}
	return false
}

// BuildCustomDomainTXTHost returns the relative DNS host label to configure at the merchant's DNS registrar.
func BuildCustomDomainTXTHost(domain string) string {
	clean := StripHostPortAndDot(domain)
	if clean == "" || IsApexDomain(clean) {
		return "_catavor-verify"
	}
	labels := strings.Split(clean, ".")
	if len(labels) >= 3 {
		// Detect apex tail length (2 labels, or 3 labels for multi-part ccTLD like co.id)
		suffixLen := 2
		tailTwo := labels[len(labels)-2] + "." + labels[len(labels)-1]
		if len(labels) >= 4 && multiPartPublicSuffixes[tailTwo] {
			suffixLen = 3
		}
		subLabels := labels[:len(labels)-suffixLen]
		if len(subLabels) > 0 {
			return "_catavor-verify." + strings.Join(subLabels, ".")
		}
	}
	return "_catavor-verify"
}

// BuildCustomDomainTXTFullHost returns the FQDN TXT lookup target (_catavor-verify.<domain>).
func BuildCustomDomainTXTFullHost(domain string) string {
	clean := StripHostPortAndDot(domain)
	if clean == "" {
		return ""
	}
	return "_catavor-verify." + clean
}

// GenerateDomainVerificationToken generates a cryptographically random TXT verification value.
func GenerateDomainVerificationToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "catavor-verify=" + hex.EncodeToString(buf), nil
}

// DNSVerificationResult summarizes live ownership and routing checks for a custom domain.
type DNSVerificationResult struct {
	OwnershipVerified bool     `json:"ownership_verified"`
	RoutingVerified   bool     `json:"routing_verified"`
	Verified          bool     `json:"verified"`
	CNAMEObserved     string   `json:"cname_observed,omitempty"`
	ObservedIPs       []string `json:"observed_ips,omitempty"`
	ErrorMessage      string   `json:"error_message,omitempty"`
}

// VerifyCustomDomainDNS checks TXT ownership proof and CNAME/A routing alignment using resolver.
func VerifyCustomDomainDNS(
	ctx context.Context,
	domain string,
	token string,
	cnameTarget string,
	edgeIP string,
	resolver DomainDNSResolver,
) DNSVerificationResult {
	if resolver == nil {
		resolver = DefaultDomainDNSResolver{}
	}
	cleanDomain := StripHostPortAndDot(domain)
	cleanTarget := StripHostPortAndDot(cnameTarget)
	if cleanTarget == "" {
		cleanTarget = "cname.catavor.com"
	}
	trimmedToken := strings.TrimSpace(token)

	res := DNSVerificationResult{}

	// 1. TXT Ownership Check: accept token at _catavor-verify.<domain> or apex <domain>
	if trimmedToken != "" {
		txtHosts := []string{BuildCustomDomainTXTFullHost(cleanDomain), cleanDomain}
		for _, h := range txtHosts {
			records, err := resolver.LookupTXT(ctx, h)
			if err != nil {
				continue
			}
			for _, rec := range records {
				if strings.TrimSpace(rec) == trimmedToken {
					res.OwnershipVerified = true
					break
				}
			}
			if res.OwnershipVerified {
				break
			}
		}
	}

	// 2. Routing Check: CNAME equals cnameTarget OR resolved host IP matches edgeIP / cnameTarget IPs
	if cname, err := resolver.LookupCNAME(ctx, cleanDomain); err == nil {
		observedCNAME := StripHostPortAndDot(cname)
		if observedCNAME != "" && observedCNAME != cleanDomain {
			res.CNAMEObserved = observedCNAME
			if observedCNAME == cleanTarget {
				res.RoutingVerified = true
			}
		}
	}

	if !res.RoutingVerified {
		domainIPs, hostErr := resolver.LookupHost(ctx, cleanDomain)
		if hostErr == nil && len(domainIPs) > 0 {
			res.ObservedIPs = domainIPs
			expectedIPSet := map[string]bool{}
			for _, ipPart := range strings.Split(edgeIP, ",") {
				if ipClean := strings.TrimSpace(ipPart); ipClean != "" {
					expectedIPSet[ipClean] = true
				}
			}
			if targetIPs, tErr := resolver.LookupHost(ctx, cleanTarget); tErr == nil {
				for _, tip := range targetIPs {
					expectedIPSet[strings.TrimSpace(tip)] = true
				}
			}
			for _, dip := range domainIPs {
				if expectedIPSet[strings.TrimSpace(dip)] {
					res.RoutingVerified = true
					break
				}
			}
		}
	}

	res.Verified = res.OwnershipVerified && res.RoutingVerified
	if !res.Verified {
		var reasons []string
		if !res.OwnershipVerified {
			reasons = append(reasons, fmt.Sprintf("Record TXT verifikasi kepemilikan (%s = %s) belum terdeteksi", BuildCustomDomainTXTFullHost(cleanDomain), trimmedToken))
		}
		if !res.RoutingVerified {
			if IsApexDomain(cleanDomain) && strings.TrimSpace(edgeIP) != "" {
				reasons = append(reasons, fmt.Sprintf("Routing DNS domain root belum mengarah ke IP server (%s) atau CNAME %s", strings.TrimSpace(edgeIP), cleanTarget))
			} else {
				reasons = append(reasons, fmt.Sprintf("Routing DNS belum mengarah ke target %s", cleanTarget))
			}
		}
		res.ErrorMessage = strings.Join(reasons, "; ")
	}
	return res
}

// ResolvedCustomDomain holds lightweight tenant metadata bound to an active verified custom domain.
type ResolvedCustomDomain struct {
	StoreID            uint   `json:"store_id"`
	StoreSlug          string `json:"store_slug"`
	StoreTitle         string `json:"store_title"`
	CustomDomain       string `json:"custom_domain"`
	CustomDomainStatus string `json:"custom_domain_status"`
	Plan               string `json:"plan"`
}

func queryEligibleStoreByHost(db *gorm.DB, cleanHost string) (*models.Store, bool) {
	if db == nil || cleanHost == "" {
		return nil, false
	}
	var store models.Store
	if err := db.Where("LOWER(custom_domain) = ?", cleanHost).First(&store).Error; err != nil {
		return nil, false
	}
	if store.DormancyStatus == "banned" || store.DormancyStatus == "purged" || store.IsBlacklisted || store.IsSuspended || store.DormancyStatus == "suspended" {
		return &store, false
	}
	if strings.EqualFold(store.PlanStatus, "expired") {
		return &store, false
	}
	plan, err := GetPlanByCode(db, store.Plan)
	if err != nil || plan == nil || !plan.HasCustomDomain {
		return &store, false
	}
	return &store, true
}

// ResolveActiveStoreByCustomDomain resolves an incoming custom Host header to its active store (with Redis cache-aside).
func ResolveActiveStoreByCustomDomain(db *gorm.DB, cfg *config.Config, rawHost string) (*ResolvedCustomDomain, error) {
	if db == nil || IsPlatformHost(rawHost, cfg) {
		return nil, nil
	}
	cleanHost := StripHostPortAndDot(rawHost)
	if cleanHost == "" {
		return nil, nil
	}

	if cachedVal, ok := database.GetCustomDomainCache(context.Background(), cleanHost); ok && cachedVal != "" {
		if cachedVal == "MISS" {
			return nil, nil
		}
		var resolved ResolvedCustomDomain
		if err := json.Unmarshal([]byte(cachedVal), &resolved); err == nil && resolved.StoreSlug != "" {
			return &resolved, nil
		}
	}

	store, eligible := queryEligibleStoreByHost(db, cleanHost)
	if !eligible || store == nil || store.CustomDomainStatus != "active" {
		database.SetCustomDomainCache(context.Background(), cleanHost, "MISS", 30*time.Second)
		return nil, nil
	}

	resolved := &ResolvedCustomDomain{
		StoreID:            store.ID,
		StoreSlug:          store.Slug,
		StoreTitle:         store.StoreTitle,
		CustomDomain:       cleanHost,
		CustomDomainStatus: store.CustomDomainStatus,
		Plan:               store.Plan,
	}
	if bytes, err := json.Marshal(resolved); err == nil {
		database.SetCustomDomainCache(context.Background(), cleanHost, string(bytes), 2*time.Minute)
	}
	return resolved, nil
}

// IsAllowedForTLSAsk verifies whether Caddy On-Demand TLS is authorized to issue a certificate for rawDomain.
func IsAllowedForTLSAsk(db *gorm.DB, cfg *config.Config, rawDomain string) bool {
	if db == nil || IsPlatformHost(rawDomain, cfg) {
		return false
	}
	cleanHost, err := NormalizeAndValidateCustomDomain(rawDomain, cfg)
	if err != nil {
		return false
	}
	store, eligible := queryEligibleStoreByHost(db, cleanHost)
	if !eligible || store == nil {
		return false
	}
	switch store.CustomDomainStatus {
	case "active", "verifying":
		return true
	default:
		return store.CustomDomainVerifiedAt != nil && store.CustomDomainStatus != "none" && store.CustomDomainStatus != "inactive_expired"
	}
}

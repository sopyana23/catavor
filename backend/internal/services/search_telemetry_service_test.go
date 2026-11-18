package services

import (
	"testing"
	"time"

	"catavor-backend/internal/models"
)

func TestCleanSearchKeyword(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"  Kucing Anggora!  ", "kucing anggora"},
		{"PRODUK #1 (Terbaik)??", "produk 1 terbaik"},
		{"Burung   Murai    Batu", "burung murai batu"},
	}

	for _, tt := range tests {
		got := CleanSearchKeyword(tt.input)
		if got != tt.expected {
			t.Errorf("CleanSearchKeyword(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestIsValidSearchKeyword(t *testing.T) {
	valid := []string{
		"kucing anggora",
		"sepatu running pria",
		"jasa desain interior",
		"tanaman hias monstera",
		"laptop gaming murah",
		// 2-character searches (valid product acronyms/names)
		"ac",
		"tv",
		"pc",
		"hp",
		// Numbers, packaging, years, specs
		"beras 10kg",
		"rumah 2026",
		"tanah 100m2",
		"iphone 128gb",
		"kopi 500gr",
		"ram ddr4",
		// Indonesian business acronyms without vowels
		"pasang cctv",
		"tanah shgb",
		"sertifikat shm",
		"cetak npwp",
		"pajak stnk",
		"bpkb motor",
		"bayar pdam",
		"pasang plts",
		"rumah kpr",
		"pipa pvc",
		"bina umkm",
		"qris static",
	}

	for _, kw := range valid {
		if !IsValidSearchKeyword(kw) {
			t.Errorf("IsValidSearchKeyword(%q) should be valid, got invalid", kw)
		}
	}

	invalid := []string{
		"a",                                               // too short (< 2)
		"ini adalah contoh pencarian yang sangat panjang sekali melebihi delapan kata sehingga harus ditolak oleh sistem keamanan", // > 8 words
		"aaaaaaaaa",                                       // character spam (>= 4 repeated)
		"zzzzzzz",                                         // character spam
		"asdfghjkl",                                       // keyboard smash (no vowels in 5+ char word)
		"bcdfgh",                                          // keyboard smash
		"<script>alert(1)</script>",                       // XSS injection
		"union select * from users",                       // SQL injection
		"eval(payload)",                                   // code injection
		"slot gacor hari ini",                             // blacklisted spam
		"judi online deposit",                             // blacklisted spam
	}

	for _, kw := range invalid {
		if IsValidSearchKeyword(kw) {
			t.Errorf("IsValidSearchKeyword(%q) should be invalid, got valid", kw)
		}
	}
}

func TestStoreTelemetryMacroCubeAndMicroEventIsolation(t *testing.T) {
	svc := &StoreTelemetryService{
		storeBuffer:    make(map[storeDateKey]*storeMetricsAcc),
		storeCountDiff: make(map[uint]*storeCountDelta),
		trafficBuffer:  make(map[trafficSourceKey]*trafficMetricsAcc),
		audienceBuffer: make(map[audienceKey]*audienceMetricsAcc),
		productBuffer:  make(map[productDateKey]*productMetricsAcc),
		recentEvents:   make([]models.RecentVisitorEvent, 0, 100),
		storeRings:     make(map[uint][]RecentVisitorDTO),
		globalRing:     make([]RecentVisitorDTO, 0, 100),
		visitorSet:     make(map[string]int64),
		engagedSet:     make(map[string]int64),
		prodMetaCache:  make(map[uint]productMetaEntry),
		storeTypeCache: make(map[uint]string),
	}

	now := time.Date(2026, 11, 11, 14, 0, 0, 0, time.UTC)
	dateStr := "2026-11-11"

	// 1. Visitor lands on storefront (store_view) -> starts as bounce (Bounces = 1)
	svc.processEvent(StoreTelemetryEvent{
		StoreID:     10,
		StoreSlug:   "adidas",
		Event:       "store_view",
		ProductType: "physical",
		ClientIP:    "103.10.10.1",
		SessionID:   "sess_1",
		UserAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
		City:        "Jakarta",
		Timestamp:   now,
	})

	// 2. Visitor triggers micro-event (filter_intent) -> MUST NOT un-bounce them or add to recentEvents/storeRings
	svc.processEvent(StoreTelemetryEvent{
		StoreID:     10,
		StoreSlug:   "adidas",
		Event:       "filter_intent",
		ProductType: "physical",
		ClientIP:    "103.10.10.1",
		SessionID:   "sess_1",
		UserAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
		Source:      "instagram",
		City:        "Jakarta",
		Timestamp:   now,
	})

	sAcc := svc.storeBuffer[storeDateKey{StoreID: 10, Date: dateStr}]
	if sAcc == nil || sAcc.Bounces != 1 {
		t.Fatalf("Expected Bounces to remain 1 after micro-event, got %+v", sAcc)
	}
	if len(svc.recentEvents) != 1 {
		t.Fatalf("Expected recentEvents length 1 (micro-event excluded), got %d", len(svc.recentEvents))
	}
	if len(svc.globalRing) != 1 {
		t.Fatalf("Expected globalRing length 1 (micro-event excluded), got %d", len(svc.globalRing))
	}

	// Verify micro-event was recorded in macro buyer_intent cube
	intentAcc := svc.audienceBuffer[audienceKey{StoreID: 0, Date: dateStr, DimensionType: "buyer_intent", DimensionValue: "filter|instagram"}]
	if intentAcc == nil || intentAcc.Views != 1 {
		t.Fatalf("Expected buyer_intent filter|instagram Views=1, got %+v", intentAcc)
	}

	// 3. Visitor views a product (subsequent product_view in same session, isUnique=false) with price 350,000 and search attribution
	svc.processEvent(StoreTelemetryEvent{
		StoreID:       10,
		StoreSlug:     "adidas",
		Event:         "product_view",
		ProductID:     99,
		ProductName:   "Sepatu Running",
		ProductType:   "physical",
		Price:         350000,
		SearchKeyword: "sepatu running",
		ClientIP:      "103.10.10.1",
		SessionID:     "sess_1",
		UserAgent:     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
		City:          "Jakarta",
		Timestamp:     now,
	})

	// Now visitor should be un-bounced (Bounces = 0)
	if sAcc.Bounces != 0 {
		t.Fatalf("Expected Bounces=0 after real product_view, got %d", sAcc.Bounces)
	}

	// Verify price_bracket recorded Views=1 even though isUnique was false on subsequent product_view
	pbAcc := svc.audienceBuffer[audienceKey{StoreID: 0, Date: dateStr, DimensionType: "price_bracket", DimensionValue: "physical|250rb-1jt"}]
	if pbAcc == nil || pbAcc.Views != 1 {
		t.Fatalf("Expected price_bracket physical|250rb-1jt Views=1, got %+v", pbAcc)
	}

	// Verify search_click buyer_intent was recorded from SearchKeyword attribution
	scAcc := svc.audienceBuffer[audienceKey{StoreID: 0, Date: dateStr, DimensionType: "buyer_intent", DimensionValue: "search_click|physical"}]
	if scAcc == nil || scAcc.Views != 1 {
		t.Fatalf("Expected buyer_intent search_click|physical Views=1, got %+v", scAcc)
	}

	// 4. Visitor clicks WhatsApp on that product
	svc.processEvent(StoreTelemetryEvent{
		StoreID:     10,
		StoreSlug:   "adidas",
		Event:       "direct_wa_click",
		ProductID:   99,
		ProductName: "Sepatu Running",
		ProductType: "physical",
		Price:       350000,
		ClientIP:    "103.10.10.1",
		SessionID:   "sess_1",
		UserAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
		City:        "Jakarta",
		Timestamp:   now,
	})

	if pbAcc.TotalActions != 1 {
		t.Fatalf("Expected price_bracket physical|250rb-1jt TotalActions=1 after CTA click, got %d", pbAcc.TotalActions)
	}
}



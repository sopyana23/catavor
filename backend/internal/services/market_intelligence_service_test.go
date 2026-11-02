package services

import (
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
)

func TestGenerateMarketIntelligenceCSV_Benchmark(t *testing.T) {
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	cfg := config.LoadConfig()
	db, err := database.InitDB(cfg)
	if err != nil {
		t.Skip("Database not available in this test environment")
		return
	}

	start := time.Now()
	data, err := GenerateMarketIntelligenceCSV(db)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("GenerateMarketIntelligenceCSV failed: %v", err)
	}

	t.Logf("CSV Generated in %v (Bytes: %d)", elapsed, len(data))
}

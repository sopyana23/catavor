package services

import (
	"testing"
	"time"
)

func TestIsSupportWorkingHour(t *testing.T) {
	wib := time.FixedZone("WIB", 7*3600)

	cases := []struct {
		name string
		at   time.Time
		want bool
	}{
		{"monday morning inside window", time.Date(2026, 11, 23, 8, 0, 0, 0, wib), true},
		{"friday afternoon inside window", time.Date(2026, 11, 27, 16, 59, 0, 0, wib), true},
		{"before opening", time.Date(2026, 11, 24, 7, 59, 0, 0, wib), false},
		{"at closing boundary", time.Date(2026, 11, 24, 17, 0, 0, 0, wib), false},
		{"saturday", time.Date(2026, 11, 28, 10, 0, 0, 0, wib), false},
		{"sunday", time.Date(2026, 11, 29, 14, 0, 0, 0, wib), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsSupportWorkingHour(tc.at); got != tc.want {
				t.Fatalf("IsSupportWorkingHour(%v) = %v, want %v", tc.at, got, tc.want)
			}
		})
	}
}

func TestCalculateBusinessHoursSLA(t *testing.T) {
	wib := time.FixedZone("WIB", 7*3600)

	cases := []struct {
		name     string
		start    time.Time
		duration time.Duration
		wantWIB  time.Time
	}{
		{
			name:     "same working day",
			start:    time.Date(2026, 11, 23, 10, 0, 0, 0, wib), // Monday 10:00
			duration: 2 * time.Hour,
			wantWIB:  time.Date(2026, 11, 23, 12, 0, 0, 0, wib),
		},
		{
			name:     "friday afternoon rolls over weekend to monday morning",
			start:    time.Date(2026, 11, 27, 16, 45, 0, 0, wib), // Friday 16:45
			duration: 30 * time.Minute,
			wantWIB:  time.Date(2026, 11, 30, 8, 15, 0, 0, wib), // Monday 08:15
		},
		{
			name:     "created on saturday starts monday 08:00 WIB",
			start:    time.Date(2026, 11, 28, 11, 0, 0, 0, wib), // Saturday 11:00
			duration: 2 * time.Hour,
			wantWIB:  time.Date(2026, 11, 30, 10, 0, 0, 0, wib), // Monday 10:00
		},
		{
			name:     "created before 08:00 WIB starts at 08:00 WIB",
			start:    time.Date(2026, 11, 24, 6, 30, 0, 0, wib), // Tuesday 06:30
			duration: 30 * time.Minute,
			wantWIB:  time.Date(2026, 11, 24, 8, 30, 0, 0, wib), // Tuesday 08:30
		},
		{
			name:     "multi-day rollover thursday 15:00 + 8h -> friday 14:00 WIB",
			start:    time.Date(2026, 11, 26, 15, 0, 0, 0, wib), // Thursday 15:00 (2h left today, 6h Friday)
			duration: 8 * time.Hour,
			wantWIB:  time.Date(2026, 11, 27, 14, 0, 0, 0, wib), // Friday 14:00
		},
		{
			name:     "exact closing boundary starts next working morning",
			start:    time.Date(2026, 11, 25, 17, 0, 0, 0, wib), // Wednesday 17:00
			duration: 2 * time.Hour,
			wantWIB:  time.Date(2026, 11, 26, 10, 0, 0, 0, wib), // Thursday 10:00
		},
		{
			name:     "non-positive duration returns start UTC",
			start:    time.Date(2026, 11, 25, 12, 0, 0, 0, wib),
			duration: 0,
			wantWIB:  time.Date(2026, 11, 25, 12, 0, 0, 0, wib),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CalculateBusinessHoursSLA(tc.start, tc.duration)
			wantUTC := tc.wantWIB.UTC()
			if !got.Equal(wantUTC) {
				t.Fatalf("got %s (%s WIB), want %s (%s WIB)", got, got.In(wib), wantUTC, tc.wantWIB)
			}
		})
	}
}

func TestFormatSLATargetLabel(t *testing.T) {
	if got := FormatSLATargetLabel("enterprise"); got != "30 menit jam kerja" {
		t.Fatalf("unexpected enterprise label: %q", got)
	}
	if got := FormatSLATargetLabel("PRO"); got != "2 jam jam kerja" {
		t.Fatalf("unexpected pro label: %q", got)
	}
	if got := FormatSLATargetLabel("free"); got != "8 jam jam kerja" {
		t.Fatalf("unexpected free label: %q", got)
	}
}

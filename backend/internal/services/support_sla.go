package services

import (
	"strings"
	"time"
)

var supportWIBLocation = time.FixedZone("WIB", 7*3600)

const (
	supportWorkStartHour = 8
	supportWorkEndHour   = 17
)

// IsSupportWorkingHour reports whether t falls within official CS operating hours
// (Monday through Friday, 08:00 <= local WIB hour < 17:00).
func IsSupportWorkingHour(t time.Time) bool {
	local := t.In(supportWIBLocation)
	wd := local.Weekday()
	if wd < time.Monday || wd > time.Friday {
		return false
	}
	h := local.Hour()
	return h >= supportWorkStartHour && h < supportWorkEndHour
}

// CalculateBusinessHoursSLA computes the SLA deadline in UTC by advancing only
// through official support operating hours (Mon-Fri 08:00-17:00 WIB).
func CalculateBusinessHoursSLA(start time.Time, slaDuration time.Duration) time.Time {
	if slaDuration <= 0 {
		return start.UTC()
	}

	cur := start.In(supportWIBLocation)
	remaining := slaDuration

	for remaining > 0 {
		wd := cur.Weekday()
		// Skip Saturday & Sunday straight to Monday 08:00 WIB.
		if wd == time.Saturday || wd == time.Sunday {
			daysUntilMon := 1
			if wd == time.Saturday {
				daysUntilMon = 2
			}
			cur = time.Date(cur.Year(), cur.Month(), cur.Day()+daysUntilMon, supportWorkStartHour, 0, 0, 0, supportWIBLocation)
			continue
		}

		dayStart := time.Date(cur.Year(), cur.Month(), cur.Day(), supportWorkStartHour, 0, 0, 0, supportWIBLocation)
		dayEnd := time.Date(cur.Year(), cur.Month(), cur.Day(), supportWorkEndHour, 0, 0, 0, supportWIBLocation)

		if cur.Before(dayStart) {
			cur = dayStart
		}
		if !cur.Before(dayEnd) {
			// Advance past end-of-day to the next calendar day at 08:00 WIB.
			cur = time.Date(cur.Year(), cur.Month(), cur.Day()+1, supportWorkStartHour, 0, 0, 0, supportWIBLocation)
			continue
		}

		available := dayEnd.Sub(cur)
		if remaining <= available {
			return cur.Add(remaining).UTC()
		}

		remaining -= available
		cur = time.Date(cur.Year(), cur.Month(), cur.Day()+1, supportWorkStartHour, 0, 0, 0, supportWIBLocation)
	}

	return cur.UTC()
}

// ResolveSupportSLADuration returns the business-hours first-response SLA duration per store plan.
func ResolveSupportSLADuration(storePlan string) time.Duration {
	switch strings.ToLower(strings.TrimSpace(storePlan)) {
	case "pro_business", "enterprise":
		return 30 * time.Minute
	case "pro_starter", "pro":
		return 2 * time.Hour
	default:
		return 8 * time.Hour
	}
}

// FormatSLATargetLabel returns human-readable business-hours SLA target per store plan.
func FormatSLATargetLabel(storePlan string) string {
	switch strings.ToLower(strings.TrimSpace(storePlan)) {
	case "pro_business", "enterprise":
		return "30 menit jam kerja"
	case "pro_starter", "pro":
		return "2 jam jam kerja"
	default:
		return "8 jam jam kerja"
	}
}

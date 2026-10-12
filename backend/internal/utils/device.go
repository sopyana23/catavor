package utils

import (
	"strings"
)

type DeviceInfo struct {
	DeviceName string // e.g. "Chrome di Windows"
	DeviceType string // "desktop" | "mobile" | "tablet"
	Browser    string // "Chrome", "Safari", "Firefox", "Edge", etc.
	OS         string // "Windows 11", "macOS", "iOS", "Android", "Linux"
}

// ParseUserAgent extracts operating system, browser, and device type from User-Agent string.
func ParseUserAgent(ua string) DeviceInfo {
	if ua == "" {
		return DeviceInfo{
			DeviceName: "Perangkat Tidak Dikenal",
			DeviceType: "desktop",
			Browser:    "Browser Web",
			OS:         "Sistem Operasi",
		}
	}

	lower := strings.ToLower(ua)

	// 1. Detect Device Type
	deviceType := "desktop"
	if strings.Contains(lower, "ipad") || strings.Contains(lower, "tablet") || (strings.Contains(lower, "android") && !strings.Contains(lower, "mobile")) {
		deviceType = "tablet"
	} else if strings.Contains(lower, "mobile") || strings.Contains(lower, "iphone") || strings.Contains(lower, "ipod") || strings.Contains(lower, "android") {
		deviceType = "mobile"
	}

	// 2. Detect OS
	os := "Sistem Operasi Lainnya"
	switch {
	case strings.Contains(lower, "windows nt 10.0"):
		os = "Windows 10/11"
	case strings.Contains(lower, "windows nt 6.3"):
		os = "Windows 8.1"
	case strings.Contains(lower, "windows nt 6.1"):
		os = "Windows 7"
	case strings.Contains(lower, "windows"):
		os = "Windows"
	case strings.Contains(lower, "iphone") || strings.Contains(lower, "ipod"):
		os = "iOS"
	case strings.Contains(lower, "ipad"):
		os = "iPadOS"
	case strings.Contains(lower, "mac os x") || strings.Contains(lower, "macintosh"):
		os = "macOS"
	case strings.Contains(lower, "android"):
		os = "Android"
	case strings.Contains(lower, "cros"):
		os = "ChromeOS"
	case strings.Contains(lower, "linux"):
		os = "Linux"
	}

	// 3. Detect Browser
	browser := "Browser Web"
	switch {
	case strings.Contains(lower, "edg/"):
		browser = "Microsoft Edge"
	case strings.Contains(lower, "opr/") || strings.Contains(lower, "opera"):
		browser = "Opera"
	case strings.Contains(lower, "samsungbrowser"):
		browser = "Samsung Internet"
	case strings.Contains(lower, "chrome") && !strings.Contains(lower, "edg/"):
		browser = "Chrome"
	case strings.Contains(lower, "firefox"):
		browser = "Firefox"
	case strings.Contains(lower, "safari") && !strings.Contains(lower, "chrome"):
		browser = "Safari"
	}

	// 4. Construct Friendly Device Name
	deviceName := browser + " di " + os
	if deviceType == "mobile" && os == "iOS" {
		deviceName = browser + " di iPhone"
	} else if deviceType == "tablet" && os == "iPadOS" {
		deviceName = browser + " di iPad"
	} else if deviceType == "mobile" && os == "Android" {
		deviceName = browser + " di Android"
	}

	return DeviceInfo{
		DeviceName: deviceName,
		DeviceType: deviceType,
		Browser:    browser,
		OS:         os,
	}
}

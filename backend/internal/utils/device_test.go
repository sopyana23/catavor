package utils

import "testing"

// TestParseUserAgent menutup seluruh cabang ParseUserAgent: deteksi tipe
// perangkat, OS, browser, dan penyusunan nama ramah. Fungsi ini dipakai untuk
// mencatat perangkat pada log sesi/keamanan, jadi salah klasifikasi = data
// audit yang menyesatkan.
func TestParseUserAgent(t *testing.T) {
	const (
		uaIPhone  = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
		uaIPad    = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
		uaAndroid = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
		uaTablet  = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		uaEdge    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
		uaChrome  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		uaFirefox = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
		uaSafari  = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
		uaOpera   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0"
		uaSamsung = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.0.0 Mobile Safari/537.36"
		uaCrOS    = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	)

	tests := []struct {
		name string
		ua   string
		want DeviceInfo
	}{
		{
			name: "kosong",
			ua:   "",
			want: DeviceInfo{
				DeviceName: "Perangkat Tidak Dikenal",
				DeviceType: "desktop",
				Browser:    "Browser Web",
				OS:         "Sistem Operasi",
			},
		},
		{
			name: "chrome_windows_11",
			ua:   uaChrome,
			want: DeviceInfo{DeviceName: "Chrome di Windows 10/11", DeviceType: "desktop", Browser: "Chrome", OS: "Windows 10/11"},
		},
		{
			name: "edge_windows",
			ua:   uaEdge,
			want: DeviceInfo{DeviceName: "Microsoft Edge di Windows 10/11", DeviceType: "desktop", Browser: "Microsoft Edge", OS: "Windows 10/11"},
		},
		{
			name: "firefox_linux",
			ua:   uaFirefox,
			want: DeviceInfo{DeviceName: "Firefox di Linux", DeviceType: "desktop", Browser: "Firefox", OS: "Linux"},
		},
		{
			name: "safari_macos",
			ua:   uaSafari,
			want: DeviceInfo{DeviceName: "Safari di macOS", DeviceType: "desktop", Browser: "Safari", OS: "macOS"},
		},
		{
			name: "safari_iphone",
			ua:   uaIPhone,
			want: DeviceInfo{DeviceName: "Safari di iPhone", DeviceType: "mobile", Browser: "Safari", OS: "iOS"},
		},
		{
			name: "safari_ipad",
			ua:   uaIPad,
			want: DeviceInfo{DeviceName: "Safari di iPad", DeviceType: "tablet", Browser: "Safari", OS: "iPadOS"},
		},
		{
			name: "chrome_android_mobile",
			ua:   uaAndroid,
			want: DeviceInfo{DeviceName: "Chrome di Android", DeviceType: "mobile", Browser: "Chrome", OS: "Android"},
		},
		{
			name: "chrome_android_tablet",
			ua:   uaTablet,
			want: DeviceInfo{DeviceName: "Chrome di Android", DeviceType: "tablet", Browser: "Chrome", OS: "Android"},
		},
		{
			name: "opera_windows",
			ua:   uaOpera,
			want: DeviceInfo{DeviceName: "Opera di Windows 10/11", DeviceType: "desktop", Browser: "Opera", OS: "Windows 10/11"},
		},
		{
			name: "samsung_android",
			ua:   uaSamsung,
			want: DeviceInfo{DeviceName: "Samsung Internet di Android", DeviceType: "mobile", Browser: "Samsung Internet", OS: "Android"},
		},
		{
			name: "chromeos",
			ua:   uaCrOS,
			want: DeviceInfo{DeviceName: "Chrome di ChromeOS", DeviceType: "desktop", Browser: "Chrome", OS: "ChromeOS"},
		},
		{
			name: "windows_7",
			ua:   "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0 Safari/537.36",
			want: DeviceInfo{DeviceName: "Chrome di Windows 7", DeviceType: "desktop", Browser: "Chrome", OS: "Windows 7"},
		},
		{
			name: "windows_8_1",
			ua:   "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0 Safari/537.36",
			want: DeviceInfo{DeviceName: "Chrome di Windows 8.1", DeviceType: "desktop", Browser: "Chrome", OS: "Windows 8.1"},
		},
		{
			name: "windows_generik",
			ua:   "Mozilla/5.0 (Windows)",
			want: DeviceInfo{DeviceName: "Browser Web di Windows", DeviceType: "desktop", Browser: "Browser Web", OS: "Windows"},
		},
		{
			name: "bot_tidak_dikenal",
			ua:   "SomeCrawlerBot/1.0",
			want: DeviceInfo{DeviceName: "Browser Web di Sistem Operasi Lainnya", DeviceType: "desktop", Browser: "Browser Web", OS: "Sistem Operasi Lainnya"},
		},
		{
			name: "ipod_mobile",
			ua:   "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1",
			want: DeviceInfo{DeviceName: "Safari di iPhone", DeviceType: "mobile", Browser: "Safari", OS: "iOS"},
		},
		{
			name: "generik_tablet_keyword",
			ua:   "Mozilla/5.0 (Linux; Tablet) AppleWebKit/537.36 Chrome/120 Safari/537.36",
			want: DeviceInfo{DeviceName: "Chrome di Linux", DeviceType: "tablet", Browser: "Chrome", OS: "Linux"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseUserAgent(tc.ua)
			if got != tc.want {
				t.Errorf("ParseUserAgent() = %+v, want %+v", got, tc.want)
			}
		})
	}
}

// TestParseUserAgentCaseInsensitive memastikan deteksi tidak bergantung pada
// kapitalisasi UA (klien boleh mengirim huruf besar).
func TestParseUserAgentCaseInsensitive(t *testing.T) {
	lower := ParseUserAgent("mozilla/5.0 (windows nt 10.0) applewebkit/537.36 chrome/120 safari/537.36")
	upper := ParseUserAgent("MOZILLA/5.0 (WINDOWS NT 10.0) APPLEWEBKIT/537.36 CHROME/120 SAFARI/537.36")
	if lower != upper {
		t.Errorf("hasil berbeda antar kapitalisasi: lower=%+v upper=%+v", lower, upper)
	}
	if lower.Browser != "Chrome" || lower.OS != "Windows 10/11" {
		t.Errorf("deteksi gagal: %+v", lower)
	}
}

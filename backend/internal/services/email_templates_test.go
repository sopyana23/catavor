package services

import (
	"strings"
	"testing"
)

// Semua builder email menerima teks yang berasal dari pengguna (nama toko,
// catatan admin, nama agen, pesan tiket). Body email adalah HTML, jadi setiap
// nilai wajib di-escape sebelum masuk template.
const payloadXSS = `<script>alert(1)</script><img src=x onerror=alert(2)>`

func TestEmailBuilders_EscapeUserInput(t *testing.T) {
	type builder struct {
		name string
		call func() (string, string)
	}
	builders := []builder{
		{"Banned", func() (string, string) {
			return BuildBannedEmail(payloadXSS, payloadXSS, payloadXSS, "RPT-1", payloadXSS)
		}},
		{"Suspended", func() (string, string) {
			return BuildSuspendedEmail(payloadXSS, payloadXSS, payloadXSS, "RPT-2", payloadXSS)
		}},
		{"Restored", func() (string, string) {
			return BuildRestoredEmail(payloadXSS, "RPT-3", payloadXSS)
		}},
		{"Warning", func() (string, string) {
			return BuildWarningEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS, "RPT-4", payloadXSS)
		}},
		{"SupportReply", func() (string, string) {
			return BuildSupportReplyEmail(payloadXSS, payloadXSS, "TKT-1", payloadXSS, payloadXSS, payloadXSS, payloadXSS)
		}},
		{"ReporterReceived", func() (string, string) {
			return BuildReporterReceivedEmail("RPT-5", payloadXSS, payloadXSS, payloadXSS, payloadXSS, payloadXSS)
		}},
		{"ReporterOutcome", func() (string, string) {
			return BuildReporterOutcomeEmail("RPT-6", payloadXSS, payloadXSS, payloadXSS, payloadXSS, payloadXSS)
		}},
		{"ItemNeedsFix", func() (string, string) {
			return BuildItemNeedsFixEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS, payloadXSS, "RPT-7", payloadXSS)
		}},
		{"ItemLocked", func() (string, string) {
			return BuildItemLockedEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS, payloadXSS, "RPT-8", payloadXSS)
		}},
		{"ItemApproved", func() (string, string) {
			return BuildItemApprovedEmail(payloadXSS, payloadXSS, "RPT-9", payloadXSS)
		}},
		{"ItemTakedown", func() (string, string) {
			return BuildItemTakedownEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS, "RPT-10", payloadXSS)
		}},
		{"ItemBanned", func() (string, string) {
			return BuildItemBannedEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS, payloadXSS, "RPT-11", payloadXSS)
		}},
		{"ItemRetentionReminder", func() (string, string) {
			return BuildItemRetentionReminderEmail(payloadXSS, payloadXSS, "RPT-12", payloadXSS, 3)
		}},
		{"ItemRetentionSoftDeleted", func() (string, string) {
			return BuildItemRetentionSoftDeletedEmail(payloadXSS, payloadXSS, "RPT-13", payloadXSS)
		}},
		{"PasswordChanged", func() (string, string) {
			return BuildPasswordChangedSecurityEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS)
		}},
		{"NewDeviceLogin", func() (string, string) {
			return BuildNewDeviceLoginSecurityEmail(payloadXSS, payloadXSS, payloadXSS, payloadXSS)
		}},
	}

	for _, b := range builders {
		t.Run(b.name, func(t *testing.T) {
			subject, body := b.call()
			if strings.TrimSpace(subject) == "" {
				t.Fatal("subject kosong")
			}
			if !strings.Contains(body, "<!DOCTYPE html>") {
				t.Error("body bukan dokumen HTML lengkap (layout tidak terpakai)")
			}
			for _, raw := range []string{"<script>", "<img src=x onerror="} {
				if strings.Contains(body, raw) {
					t.Errorf("input pengguna tidak di-escape, ditemukan %q mentah", raw)
				}
			}
			if !strings.Contains(body, "&lt;script&gt;") {
				t.Error("escape HTML tidak menghasilkan entitas &lt;script&gt;")
			}
		})
	}
}

func TestGetBaseURL(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		t.Setenv("APP_URL", "")
		if got := getBaseURL(); got != "http://localhost:8000" {
			t.Errorf("getBaseURL() = %q, want default", got)
		}
	})
	t.Run("trailing_slash_dibuang", func(t *testing.T) {
		t.Setenv("APP_URL", "https://catavor.id///")
		if got := getBaseURL(); got != "https://catavor.id" {
			t.Errorf("getBaseURL() = %q, want https://catavor.id", got)
		}
	})
}

func TestWrapEmailLayout_CTA(t *testing.T) {
	t.Setenv("APP_URL", "https://catavor.id")

	t.Run("relatif_dijadikan_absolut", func(t *testing.T) {
		out := wrapEmailLayout("BADGE", "#000", "Judul", "Sub", "<p>x</p>", "Buka", "/catalogs")
		if !strings.Contains(out, `href="https://catavor.id/catalogs"`) {
			t.Error("URL relatif tidak dinormalisasi ke base URL")
		}
		if !strings.Contains(out, "BADGE") || !strings.Contains(out, "Judul") || !strings.Contains(out, "<p>x</p>") {
			t.Error("konten layout tidak lengkap")
		}
	})

	t.Run("absolut_dipertahankan", func(t *testing.T) {
		out := wrapEmailLayout("B", "#000", "J", "S", "<p>x</p>", "Buka", "https://lain.example/path")
		if !strings.Contains(out, `href="https://lain.example/path"`) {
			t.Error("URL absolut diubah padahal seharusnya dipertahankan")
		}
	})

	t.Run("tanpa_cta", func(t *testing.T) {
		out := wrapEmailLayout("B", "#000", "J", "S", "<p>x</p>", "", "")
		if strings.Contains(out, "max-width: 380px") {
			t.Error("tombol CTA muncul padahal label/URL kosong")
		}
	})

	t.Run("label_tanpa_url", func(t *testing.T) {
		out := wrapEmailLayout("B", "#000", "J", "S", "<p>x</p>", "Buka", "")
		if strings.Contains(out, "max-width: 380px") {
			t.Error("tombol CTA muncul padahal URL kosong")
		}
	})
}

func TestNL2BR(t *testing.T) {
	cases := map[string]string{
		"":              "",
		"satu":          "satu",
		"a\nb":          "a<br>b",
		"a\n\nb":        "a<br><br>b",
		"sudah<br>html": "sudah<br>html",
	}
	for in, want := range cases {
		if got := nl2br(in); got != want {
			t.Errorf("nl2br(%q) = %q, want %q", in, got, want)
		}
	}
}

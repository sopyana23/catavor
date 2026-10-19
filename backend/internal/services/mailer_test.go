package services

import (
	"strings"
	"testing"
)

// TestBuildEmailMessage_HeaderInjection memastikan nilai yang berasal dari input
// pengguna (nama toko, nama pengirim) tidak bisa menyuntikkan header SMTP baru.
// Sebelum hardening, subject berisi "\r\nBcc: ..." akan menjadi header tambahan
// karena pesan disusun dengan fmt.Sprintf pada header mentah.
func TestBuildEmailMessage_HeaderInjection(t *testing.T) {
	cfg := MailConfig{From: "no-reply@catavor.id", FromName: "Catavor"}

	msg := buildEmailMessage(cfg, "user@example.com",
		"Keputusan untuk 'Toko\r\nBcc: korban@example.com' - #RPT-1",
		"Catavor\r\nReply-To: attacker@example.com",
		"<p>halo</p>")

	headerBlock := string(msg)
	if idx := strings.Index(headerBlock, "\r\n\r\n"); idx >= 0 {
		headerBlock = headerBlock[:idx]
	}

	for _, bad := range []string{"\r\nBcc:", "\r\nReply-To:", "\nBcc:", "\nReply-To:"} {
		if strings.Contains(string(msg), bad) {
			t.Fatalf("header injection tidak tersaring: %q ditemukan pada pesan", bad)
		}
	}

	// Hanya boleh ada satu baris Subject dan satu baris From.
	if n := strings.Count(headerBlock, "Subject:"); n != 1 {
		t.Errorf("Subject muncul %d kali, want 1", n)
	}
	if n := strings.Count(headerBlock, "From:"); n != 1 {
		t.Errorf("From muncul %d kali, want 1", n)
	}

	// Teks asli tetap dipertahankan (CR/LF jadi spasi), bukan dihapus total.
	if !strings.Contains(headerBlock, "Toko Bcc: korban@example.com") {
		t.Errorf("isi subject kehilangan teks asli: %q", headerBlock)
	}
}

func TestBuildEmailMessage_NormalSubjectIntact(t *testing.T) {
	cfg := MailConfig{From: "no-reply@catavor.id", FromName: "Catavor"}
	msg := buildEmailMessage(cfg, "user@example.com", "Verifikasi Akun", "Catavor", "<p>x</p>")
	s := string(msg)

	if !strings.Contains(s, "Subject: Verifikasi Akun\r\n") {
		t.Errorf("subject normal berubah: %q", s)
	}
	if !strings.Contains(s, "From: Catavor <no-reply@catavor.id>\r\n") {
		t.Errorf("from header salah: %q", s)
	}
	if !strings.Contains(s, "To: user@example.com\r\n") {
		t.Errorf("to header salah: %q", s)
	}
	if !strings.HasSuffix(s, "<p>x</p>") {
		t.Errorf("body tidak utuh: %q", s)
	}
}

func TestSanitizeHeaderValue(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"bersih", "Toko Budi", "Toko Budi"},
		{"crlf_dibuang", "Toko\r\nBcc: x@y.z", "Toko Bcc: x@y.z"},
		{"lf_saja", "Toko\nX-Test: 1", "Toko X-Test: 1"},
		{"cr_saja", "Toko\rX-Test: 1", "Toko X-Test: 1"},
		{"nul_dibuang", "Toko\x00Budi", "TokoBudi"},
		{"tab_jadi_spasi", "Toko\tBudi", "Toko Budi"},
		{"kosong", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := sanitizeHeaderValue(c.in); got != c.want {
				t.Errorf("sanitizeHeaderValue(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

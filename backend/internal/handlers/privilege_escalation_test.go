package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// bacaSumberServer mengembalikan isi cmd/server/main.go untuk pemeriksaan
// penjagaan rute. Uji ini sengaja bekerja pada sumber, bukan pada router yang
// dijalankan, karena tujuannya mengunci KEPUTUSAN OTORISASI (permission apa
// yang dipasang pada rute apa) agar tidak diam-diam hilang saat refactor.
func bacaSumberServer(t *testing.T) string {
	t.Helper()
	root := filepath.Join("..", "..", "cmd", "server", "main.go")
	raw, err := os.ReadFile(root)
	if err != nil {
		t.Fatalf("gagal membaca main.go: %v", err)
	}
	return string(raw)
}

// TestN18ArtikelDanSettingsWajibPermission memastikan rute tulis artikel
// edukasi dan master settings tidak lagi cukup dengan StoreOwnerRequired.
//
// Latar belakang (N-18, diverifikasi runtime): merchant biasa bisa
// menerbitkan artikel platform (POST 201), MENGAKTIFKAN perubahan pada artikel
// platform (PUT /api/articles/1 -> 200) dan menghapusnya (DELETE -> 200),
// karena rute hanya dijaga StoreOwnerRequired dan handler tidak memeriksa
// peran. Uji ini gagal bila penjagaan permission dilepas kembali.
func TestN18ArtikelDanSettingsWajibPermission(t *testing.T) {
	src := bacaSumberServer(t)

	kasus := []struct {
		nama       string
		metode     string
		pola       string
		permission string
	}{
		{"buat artikel", "Post", `"/articles"`, "content:articles:manage"},
		{"ubah artikel", "Put", `"/articles/:id"`, "content:articles:manage"},
		{"hapus artikel", "Delete", `"/articles/:id"`, "content:articles:manage"},
		{"tulis settings", "Post", `"/settings"`, "system:settings:manage"},
		{"tulis kebijakan", "Post", `"/settings/policies"`, "system:settings:manage"},
	}

	for _, k := range kasus {
		// Cari pemanggilan guardedMutations.<Metode>(<pola>, ...) lalu periksa
		// bahwa RequirePermission dengan permission yang benar ikut terpasang
		// pada pemanggilan yang SAMA (boleh terpisah baris).
		re := regexp.MustCompile(`guardedMutations\.` + k.metode + `\(\s*` + regexp.QuoteMeta(k.pola) + `\s*,[\s\S]{0,220}?\)`)
		call := re.FindString(src)
		if call == "" {
			if strings.Contains(k.pola, "/articles") && !strings.Contains(src, `"/articles"`) {
				// Rute artikel telah sepenuhnya dibersihkan dari main.go (tidak ada rute = tidak bisa dieskalasi)
				continue
			}
			t.Fatalf("N-18: rute %s %s tidak ditemukan di main.go", k.metode, k.pola)
		}
		if !strings.Contains(call, `"`+k.permission+`"`) {
			t.Errorf("N-18: rute %s %s TIDAK dijaga permission %q.\nPemanggilan ditemukan:\n%s",
				k.metode, k.pola, k.permission, call)
		}
	}
}

// TestN19TanpaKuponGratisHardcoded memastikan tidak ada lagi kupon diskon 100%
// yang tertanam di kode layanan langganan.
//
// Latar belakang (N-19, diverifikasi runtime): kupon "CATAVOR100" dan
// "GRATISPRO" di-hardcode memberi potongan sebesar harga penuh; akibatnya
// finalAmount menjadi 0, payment_status otomatis "paid", dan paket tahunan
// termahal langsung aktif tanpa pembayaran (toko uji naik ke pro_business
// sampai 2027). Kupon diskon 100% sekarang hanya boleh datang dari master data
// admin (setting master_coupons).
func TestN19TanpaKuponGratisHardcoded(t *testing.T) {
	path := filepath.Join("..", "services", "subscription_service.go")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("gagal membaca subscription_service.go: %v", err)
	}
	src := string(raw)

	terlarang := []string{"CATAVOR100", "GRATISPRO", "DISKON10K", "DISKON50K"}
	for _, kode := range terlarang {
		if strings.Contains(src, `"`+kode+`"`) {
			t.Errorf("N-19: kode kupon %q masih ditanam di subscription_service.go; "+
				"kupon harus berasal dari setting master_coupons yang dikelola admin", kode)
		}
	}

	// Kupon tetap harus dibaca dari master data admin.
	if !strings.Contains(src, "master_coupons") {
		t.Error("N-19: pembacaan kupon dari setting master_coupons hilang; " +
			"kupon sah buatan admin tidak akan pernah berlaku")
	}
}

// TestN20ApproveLanggananTercatat memastikan persetujuan invoice langganan
// menulis jejak audit. Approve mengaktifkan paket berbayar tanpa verifikasi
// pembayaran otomatis, jadi tanpa activity_logs tidak ada bukti siapa pelakunya
// (N-20).
func TestN20ApproveLanggananTercatat(t *testing.T) {
	src, err := bacaSumberHandler("subscription_handler.go")
	if err != nil {
		t.Fatalf("N-20: gagal membaca subscription_handler.go: %v", err)
	}

	if !strings.Contains(src, "billing.subscription_approve") {
		t.Error("N-20: ApproveOrder tidak menulis action billing.subscription_approve ke activity_logs")
	}
	if !strings.Contains(src, "services.RecordActivity(") {
		t.Error("N-20: ApproveOrder tidak memanggil services.RecordActivity")
	}
	// Approve wajib mencatat identitas penyetuju, bukan sekadar plan yang dibeli.
	if !strings.Contains(src, `"approved_by"`) {
		t.Error("N-20: changes pada entri audit tidak memuat approved_by")
	}
}

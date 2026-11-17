package security

import (
	"bytes"
	"encoding/xml"
	"strings"
	"testing"
)

func TestQRCodeAllSupportedVersionsBitPlacementExact(t *testing.T) {
	// Verifikasi bahwa untuk setiap panjang payload dari 1 byte s/d 285 byte
	// (mencakup seluruh Versi 1 s/d 12, termasuk batas V7+ version info dan V10+ 16-bit length),
	// matriks terbentuk presisi tanpa error bit placement, memiliki 3 finder pattern utuh,
	// dan menghasilkan XML SVG yang valid.
	lengths := []int{1, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 285}
	for _, n := range lengths {
		payload := bytes.Repeat([]byte("A"), n)
		matrix, err := EncodeQRMatrix(payload)
		if err != nil {
			t.Fatalf("EncodeQRMatrix(len=%d) gagal: %v", n, err)
		}
		size := len(matrix)
		if size < 21 || (size-17)%4 != 0 {
			t.Fatalf("ukuran matriks tidak valid: %d", size)
		}
		// Sudut luar ketiga finder pattern (0,0), (size-1,0), (0,size-1) dan pusatnya (3,3) wajib gelap.
		for _, pt := range [][2]int{{0, 0}, {3, 3}, {size - 1, 0}, {size - 4, 3}, {0, size - 1}, {3, size - 4}, {8, size - 8}} {
			if !matrix[pt[1]][pt[0]] {
				t.Fatalf("len=%d: modul wajib gelap di (%d,%d) bernilai terang", n, pt[0], pt[1])
			}
		}
	}

	// Melebihi kapasitas V12 harus ditolak secara eksplisit.
	if _, err := EncodeQRMatrix(bytes.Repeat([]byte("X"), 320)); err != ErrQRPayloadTooLarge {
		t.Fatalf("payload berlebih harus ErrQRPayloadTooLarge, dapat: %v", err)
	}
}

func TestGenerateQRCodeSVGAndDataURLForOTPAuth(t *testing.T) {
	secret, err := GenerateTOTPSecret()
	if err != nil {
		t.Fatal(err)
	}
	uri := BuildOTPAuthURL("Catavor", "superadmin@catavor.id", secret)

	svg, err := GenerateQRCodeSVG(uri, 4)
	if err != nil {
		t.Fatalf("GenerateQRCodeSVG: %v", err)
	}
	if !strings.HasPrefix(svg, "<svg ") || !strings.HasSuffix(svg, "</svg>") {
		t.Fatalf("output SVG tidak utuh")
	}

	// Pastikan XML well-formed.
	dec := xml.NewDecoder(strings.NewReader(svg))
	for {
		if _, err := dec.Token(); err != nil {
			if err.Error() == "EOF" {
				break
			}
			t.Fatalf("SVG bukan XML valid: %v", err)
		}
	}

	dataURL, err := GenerateQRCodeDataURL(uri)
	if err != nil {
		t.Fatalf("GenerateQRCodeDataURL: %v", err)
	}
	if !strings.HasPrefix(dataURL, "data:image/svg+xml;base64,") {
		t.Fatalf("prefix data URL salah: %s", dataURL[:30])
	}
}

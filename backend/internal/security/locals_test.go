package security

import (
	"math"
	"testing"
)

// UserIDFromLocals adalah satu-satunya jalur konversi user_id dari fiber.Locals.
// Kesalahan di sini berarti otorisasi memakai ID yang salah, jadi kontraknya
// harus dikunci: tipe apa pun yang sah harus terbaca, tipe tak dikenal dan
// nilai nol/negatif harus GAGAL (fail-closed).

func TestUserIDFromLocalsTipeSah(t *testing.T) {
	cases := []struct {
		name  string
		input interface{}
		want  uint
	}{
		{"uint", uint(42), 42},
		{"uint32", uint32(9), 9},
		{"uint64", uint64(11), 11},
		{"int", int(13), 13},
		{"int32", int32(15), 15},
		{"int64", int64(17), 17},
		{"float64 bulat", float64(19), 19},
		{"string angka", "23", 23},
		{"string angka panjang", "4294967295", 4294967295},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := UserIDFromLocals(c.input)
			if !ok {
				t.Fatalf("input sah %#v ditolak", c.input)
			}
			if got != c.want {
				t.Errorf("dapat %d, want %d", got, c.want)
			}
		})
	}
}

func TestUserIDFromLocalsHarusGagal(t *testing.T) {
	cases := []struct {
		name  string
		input interface{}
	}{
		// Nol dalam semua bentuk: ID 0 bukan user sah dan tidak boleh lolos.
		{"uint nol", uint(0)},
		{"uint64 nol", uint64(0)},
		{"int nol", int(0)},
		{"int64 nol", int64(0)},
		{"float64 nol", float64(0)},
		{"string nol", "0"},
		{"string kosong", ""},

		// Negatif tidak mungkin jadi uint yang benar.
		{"int negatif", int(-1)},
		{"int64 negatif", int64(-42)},
		{"float64 negatif", float64(-3.5)},

		// Tipe yang tidak boleh dipakai sebagai user_id.
		{"nil", nil},
		{"bool", true},
		{"slice", []int{1}},
		{"map", map[string]int{"id": 1}},
		{"struct", struct{ ID int }{1}},

		// String berbahaya / tidak valid.
		{"string huruf", "abc"},
		{"string desimal", "1.5"},
		{"string campur", "12abc"},
		{"string spasi", " 12"},
		{"string plus", "+12"},
		{"string hex", "0x1f"},
		{"string minus", "-12"},
		{"string sql injection", "1 OR 1=1"},
		{"string overflow", "99999999999999999999999999999"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := UserIDFromLocals(c.input)
			if ok {
				t.Errorf("input %#v seharusnya ditolak, tapi lolos dengan %d", c.input, got)
			}
			if got != 0 {
				t.Errorf("saat gagal harus mengembalikan 0, dapat %d", got)
			}
		})
	}
}

// TestUserIDFromLocalsFloat menutup regresi NaN/Inf: Go mengubah NaN dan +Inf
// menjadi 9223372036854775808 saat dikonversi ke integer (amd64), sehingga
// sebelum perbaikan nilai sampah itu lolos dengan ok=true.
func TestUserIDFromLocalsFloat(t *testing.T) {
	if got, ok := UserIDFromLocals(float64(5)); !ok || got != 5 {
		t.Errorf("float 5 harus jadi 5, dapat %d ok=%v", got, ok)
	}

	// Pecahan bukan representasi user_id yang sah.
	if got, ok := UserIDFromLocals(float64(5.9)); ok {
		t.Errorf("float 5.9 seharusnya ditolak, dapat %d", got)
	}
	if _, ok := UserIDFromLocals(float64(0.5)); ok {
		t.Error("float 0.5 seharusnya ditolak")
	}
	if _, ok := UserIDFromLocals(math.NaN()); ok {
		t.Error("NaN seharusnya ditolak")
	}
	if _, ok := UserIDFromLocals(math.Inf(1)); ok {
		t.Error("+Inf seharusnya ditolak")
	}
	if _, ok := UserIDFromLocals(math.Inf(-1)); ok {
		t.Error("-Inf seharusnya ditolak")
	}
}

// TestUserIDFromLocalsStringOverflow memastikan string angka raksasa tidak
// membungkus (wrap around) menjadi ID kecil yang tampak sah.
func TestUserIDFromLocalsStringOverflow(t *testing.T) {
	if _, ok := UserIDFromLocals("99999999999999999999999999999"); ok {
		t.Error("string overflow seharusnya ditolak, bukan dibungkus")
	}
	// Positive control: angka besar tapi masih dalam jangkauan harus terbaca.
	if got, ok := UserIDFromLocals("4294967295"); !ok || got != 4294967295 {
		t.Errorf("angka besar yang sah ditolak: %d ok=%v", got, ok)
	}
}

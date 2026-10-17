package handlers

import "testing"

// Self-check L1: input pengguna tidak boleh bertindak sebagai wildcard LIKE.
// Tanpa escape, "%" mencocokkan record mana pun dan "_" bisa dipakai menebak
// isi kolom karakter demi karakter.
func TestEscapeLikePattern(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"polos", "abc123", "abc123"},
		{"persen tunggal", "%", `\%`},
		{"underscore tunggal", "_", `\_`},
		{"campur", "a%b_c", `a\%b\_c`},
		{"backslash", `a\b`, `a\\b`},
		{"backslash lalu persen", `\%`, `\\\%`},
		{"wildcard penuh", `%_%`, `\%\_\%`},
		{"kosong", "", ""},
	}

	for _, tc := range cases {
		if got := escapeLikePattern(tc.in); got != tc.want {
			t.Errorf("%s: escapeLikePattern(%q) = %q, ingin %q", tc.name, tc.in, got, tc.want)
		}
	}

	// Properti penting: hasil escape tidak boleh mengandung wildcard mentah
	// yang tidak di-escape backslash.
	for _, in := range []string{"%", "_", "%%", "__", "a%b_c"} {
		out := escapeLikePattern(in)
		for i := 0; i < len(out); i++ {
			if out[i] == '%' || out[i] == '_' {
				if i == 0 || out[i-1] != '\\' {
					t.Fatalf("wildcard mentah lolos pada input %q -> %q (posisi %d)", in, out, i)
				}
			}
		}
	}
}

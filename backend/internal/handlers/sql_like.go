package handlers

import "strings"

// escapeLikePattern meng-escape karakter wildcard SQL LIKE pada input pengguna.
//
// Kenapa perlu: pada `LIKE '%' || input || '%'`, karakter "%" dan "_" yang
// dikirim pengguna tetap diperlakukan sebagai wildcard. Penyerang bisa memakai
// "%" untuk mencocokkan record mana pun yang cocok lebih dulu (ambiguous match),
// atau "_" untuk menebak isi kolom karakter demi karakter.
//
// Dipakai bersama klausa `ESCAPE '\'`. Backslash harus di-escape lebih dulu,
// kalau tidak escape berikutnya jadi ganda.
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "%", `\%`)
	s = strings.ReplaceAll(s, "_", `\_`)
	return s
}

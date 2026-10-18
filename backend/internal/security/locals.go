package security

import "math"

// UserIDFromLocals menormalkan user_id dari fiber.Ctx.Locals yang tipenya bisa
// berbeda tergantung middleware yang mengisinya (uint, int, int64, float64 —
// misalnya setelah decode JSON). Mengembalikan false bila tidak bisa dipakai.
//
// SECURITY: konversi float64 WAJIB menolak NaN dan Inf. Go mengubah NaN/±Inf
// menjadi nilai implementasi-specific saat dikonversi ke integer
// (di amd64: NaN -> 9223372036854775808), sehingga tanpa penjagaan nilai
// sampah itu lolos sebagai "user ID sah" dan bisa dipakai melewati pemeriksaan
// kepemilikan. Nilai pecahan juga ditolak: user_id selalu bilangan bulat, jadi
// 5.9 bukan representasi yang sah dan tidak boleh dipotong diam-diam menjadi 5.
func UserIDFromLocals(v interface{}) (uint, bool) {
	switch n := v.(type) {
	case uint:
		if n == 0 {
			return 0, false
		}
		return n, true
	case uint64:
		if n == 0 {
			return 0, false
		}
		return uint(n), true
	case uint32:
		if n == 0 {
			return 0, false
		}
		return uint(n), true
	case int:
		if n <= 0 {
			return 0, false
		}
		return uint(n), true
	case int64:
		if n <= 0 {
			return 0, false
		}
		return uint(n), true
	case int32:
		if n <= 0 {
			return 0, false
		}
		return uint(n), true
	case float64:
		// Tolak NaN, ±Inf, dan nilai pecahan sebelum konversi.
		if math.IsNaN(n) || math.IsInf(n, 0) || n != math.Trunc(n) {
			return 0, false
		}
		if n <= 0 {
			return 0, false
		}
		// Tolak nilai di luar jangkauan uint agar tidak terjadi overflow.
		if n >= float64(^uint(0)) {
			return 0, false
		}
		return uint(n), true
	case string:
		var acc uint
		if n == "" {
			return 0, false
		}
		for i := 0; i < len(n); i++ {
			d := n[i]
			if d < '0' || d > '9' {
				return 0, false
			}
			// Cegah overflow: bila acc sudah besar, digit berikutnya bisa
			// membungkus ke nilai kecil yang tampak sah.
			if acc > (^uint(0)-uint(d-'0'))/10 {
				return 0, false
			}
			acc = acc*10 + uint(d-'0')
		}
		if acc == 0 {
			return 0, false
		}
		return acc, true
	}
	return 0, false
}

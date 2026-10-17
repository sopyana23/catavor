package security

// UserIDFromLocals menormalkan user_id dari fiber.Ctx.Locals yang tipenya bisa
// berbeda tergantung middleware yang mengisinya (uint, int, int64, float64 —
// misalnya setelah decode JSON). Mengembalikan false bila tidak bisa dipakai.
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
		if n <= 0 {
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
			acc = acc*10 + uint(d-'0')
		}
		if acc == 0 {
			return 0, false
		}
		return acc, true
	}
	return 0, false
}

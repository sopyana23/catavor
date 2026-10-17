package security

import (
	"encoding/base64"
	"strings"
	"sync"
	"testing"
)

// TestSSETicketSingleUse memastikan tiket hanya bisa dipakai sekali.
func TestSSETicketSingleUse(t *testing.T) {
	ResetSSETickets()

	ticket, _, err := IssueSSETicket(42)
	if err != nil {
		t.Fatalf("issue gagal: %v", err)
	}
	if ticket == "" {
		t.Fatal("tiket kosong")
	}

	uid, ok := ConsumeSSETicket(ticket)
	if !ok || uid != 42 {
		t.Fatalf("pemakaian pertama harus berhasil: ok=%v uid=%d", ok, uid)
	}

	// Pemakaian kedua harus ditolak (replay).
	if _, ok := ConsumeSSETicket(ticket); ok {
		t.Fatal("tiket dipakai dua kali — replay tidak dicegah")
	}
}

// TestSSETicketUnknown memastikan tiket palsu ditolak.
func TestSSETicketUnknown(t *testing.T) {
	ResetSSETickets()

	for _, bad := range []string{"", "palsu", strings.Repeat("a", 43)} {
		if _, ok := ConsumeSSETicket(bad); ok {
			t.Fatalf("tiket tidak sah diterima: %q", bad)
		}
	}
}

// TestSSETicketEntropy memastikan tiket acak, cukup panjang, dan unik.
func TestSSETicketEntropy(t *testing.T) {
	ResetSSETickets()

	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		ticket, _, err := IssueSSETicket(uint(i + 1))
		if err != nil {
			t.Fatalf("issue gagal: %v", err)
		}
		if len(ticket) < 40 {
			t.Fatalf("tiket terlalu pendek (%d char): %q", len(ticket), ticket)
		}
		raw, err := base64.RawURLEncoding.DecodeString(ticket)
		if err != nil {
			t.Fatalf("tiket bukan base64url valid: %v", err)
		}
		if len(raw) != 32 {
			t.Fatalf("entropi kurang: %d byte, harus 32", len(raw))
		}
		if seen[ticket] {
			t.Fatal("tiket duplikat — PRNG bermasalah")
		}
		seen[ticket] = true
	}
}

// TestSSETicketPerUserCap memastikan tiket hidup per user dibatasi, sehingga
// klien yang membuka stream berulang tidak menumpuk memori tanpa batas.
func TestSSETicketPerUserCap(t *testing.T) {
	ResetSSETickets()

	// Ambil lebih banyak dari batas.
	for i := 0; i < sseTicketMaxLive+4; i++ {
		if _, _, err := IssueSSETicket(7); err != nil {
			t.Fatalf("issue gagal: %v", err)
		}
	}

	sseTicketMu.Lock()
	live := 0
	for _, v := range sseTickets {
		if v.userID == 7 {
			live++
		}
	}
	sseTicketMu.Unlock()

	if live > sseTicketMaxLive {
		t.Fatalf("tiket hidup %d melebihi batas %d", live, sseTicketMaxLive)
	}
}

// TestSSETicketIsolation memastikan tiket milik user lain tidak membuka akses
// sebagai user tersebut, dan tiket user A tidak dianggap milik user B.
func TestSSETicketIsolation(t *testing.T) {
	ResetSSETickets()

	tA, _, _ := IssueSSETicket(1)
	tB, _, _ := IssueSSETicket(2)

	if uid, ok := ConsumeSSETicket(tA); !ok || uid != 1 {
		t.Fatalf("tiket A salah pemilik: ok=%v uid=%d", ok, uid)
	}
	if uid, ok := ConsumeSSETicket(tB); !ok || uid != 2 {
		t.Fatalf("tiket B salah pemilik: ok=%v uid=%d", ok, uid)
	}
}

// TestSSETicketConcurrent memastikan tidak ada dua goroutine yang berhasil
// memakai tiket yang sama (race pada consume).
func TestSSETicketConcurrent(t *testing.T) {
	ResetSSETickets()

	ticket, _, err := IssueSSETicket(99)
	if err != nil {
		t.Fatalf("issue gagal: %v", err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, ok := ConsumeSSETicket(ticket); ok {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if success != 1 {
		t.Fatalf("tiket dipakai %d kali oleh goroutine berbeda; harus tepat 1", success)
	}
}

// TestUserIDFromLocals menguji normalisasi tipe user_id dari Locals.
func TestUserIDFromLocals(t *testing.T) {
	cases := []struct {
		in   interface{}
		want uint
		ok   bool
	}{
		{uint(5), 5, true},
		{int(7), 7, true},
		{int64(9), 9, true},
		{float64(11), 11, true},
		{"13", 13, true},
		{uint(0), 0, false},
		{int(-1), 0, false},
		{"", 0, false},
		{"abc", 0, false},
		{nil, 0, false},
	}
	for _, c := range cases {
		got, ok := UserIDFromLocals(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Fatalf("UserIDFromLocals(%#v) = (%d,%v); harap (%d,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}

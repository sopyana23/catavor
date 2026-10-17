package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"sync"
	"time"
)

// SECURITY (M1/SSE): tiket sekali pakai untuk EventSource.
//
// Masalah: EventSource tidak bisa mengirim header kustom, sehingga JWT harus
// ditaruh di query string (?token=...). URL mudah bocor lewat access log,
// header Referer, riwayat browser, dan cache proxy — JWT berumur 12 jam yang
// bocor dari log sama buruknya dengan tidak mengunci apa pun.
//
// Solusi: klien menukar sesinya (cookie HttpOnly) dengan tiket berumur pendek
// lewat POST /api/notifications/ticket. Tiket hanya bisa dipakai SEKALI dan
// hanya hidup 30 detik. Kalau bocor di log, nilainya sudah mati sebelum
// penyerang sempat memakainya.
//
// Paket ini sengaja berdiri sendiri (tanpa import middleware/handlers) agar
// tidak menimbulkan import cycle.

const (
	SSETicketTTL     = 30 * time.Second
	sseTicketMaxLive = 8 // batas tiket aktif per user, cegah penumpukan memori
)

type sseTicket struct {
	userID    uint
	expiresAt time.Time
}

var (
	sseTicketMu sync.Mutex
	sseTickets  = map[string]sseTicket{}
)

// IssueSSETicket membuat tiket acak 32 byte untuk user tertentu.
func IssueSSETicket(userID uint) (string, time.Time, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", time.Time{}, err
	}
	ticket := base64.RawURLEncoding.EncodeToString(buf)
	exp := time.Now().Add(SSETicketTTL)

	sseTicketMu.Lock()
	defer sseTicketMu.Unlock()

	// Bersihkan tiket kedaluwarsa dan hitung tiket hidup milik user ini.
	live := 0
	now := time.Now()
	for k, v := range sseTickets {
		if now.After(v.expiresAt) {
			delete(sseTickets, k)
			continue
		}
		if v.userID == userID {
			live++
		}
	}

	// Kalau user membuka terlalu banyak stream, buang yang paling cepat habis.
	if live >= sseTicketMaxLive {
		var oldestKey string
		var oldest time.Time
		for k, v := range sseTickets {
			if v.userID != userID {
				continue
			}
			if oldestKey == "" || v.expiresAt.Before(oldest) {
				oldestKey, oldest = k, v.expiresAt
			}
		}
		if oldestKey != "" {
			delete(sseTickets, oldestKey)
		}
	}

	sseTickets[ticket] = sseTicket{userID: userID, expiresAt: exp}
	return ticket, exp, nil
}

// ConsumeSSETicket memvalidasi dan langsung menghapus tiket (single use).
func ConsumeSSETicket(ticket string) (uint, bool) {
	if ticket == "" {
		return 0, false
	}
	sseTicketMu.Lock()
	t, ok := sseTickets[ticket]
	if ok {
		delete(sseTickets, ticket)
	}
	sseTicketMu.Unlock()

	if !ok || time.Now().After(t.expiresAt) {
		return 0, false
	}
	return t.userID, true
}

// ResetSSETickets hanya untuk pengujian.
func ResetSSETickets() {
	sseTicketMu.Lock()
	sseTickets = map[string]sseTicket{}
	sseTicketMu.Unlock()
}

// TicketFingerprint dipakai untuk log tanpa membocorkan tiket utuh.
func TicketFingerprint(ticket string) string {
	sum := sha256.Sum256([]byte(ticket))
	return hex.EncodeToString(sum[:8])
}

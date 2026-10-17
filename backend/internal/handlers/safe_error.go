package handlers

import (
	"errors"
	"strings"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// safeErrMsg mengembalikan pesan error yang aman ditampilkan ke klien.
//
// Aturan:
//   - Error dari GORM / driver DB (SQL, tabel, kolom, koneksi) TIDAK pernah
//     dikembalikan apa adanya — bisa membocorkan skema & kredensial.
//   - Error bisnis yang ditulis sendiri (errors.New / fmt.Errorf di services)
//     tetap ditampilkan karena memang pesan untuk pengguna.
//   - Selain itu: generik.
//
// Detail lengkap selalu dicatat ke log server oleh pemanggil.
func safeErrMsg(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	// GORM sentinel errors -> jangan bocorkan detail.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "Data tidak ditemukan."
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return "Data sudah ada."
	}

	msg := err.Error()

	// Deteksi jejak error DB/driver yang tidak boleh tampil ke klien.
	lower := strings.ToLower(msg)
	dbLeaks := []string{
		"sql:", "sqlstate", "pq:", "driver", "gorm", "record not found",
		"duplicate key", "syntax error", "column", "relation \"", "constraint",
		"dial tcp", "connection refused", "no such host", "timeout expired",
		"panic", "runtime error", "nil pointer",
	}
	for _, leak := range dbLeaks {
		if strings.Contains(lower, leak) {
			log.Error().Err(err).Msg("menyembunyikan detail error internal dari klien")
			return fallback
		}
	}
	return msg
}

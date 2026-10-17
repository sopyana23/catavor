//go:build ignore

// Utilitas rotasi password akun uji.
//
// Bukan bagian dari server — dijalankan manual saat kredensial uji perlu diganti
// (misalnya karena sempat muncul di log/chat). Memakai bcrypt cost 12 yang sama
// dengan models.User.SetPassword agar hash kompatibel.
//
// Pemakaian:
//   cd backend
//   go run scripts/rotate-test-password.go -email user@example.com -password 'Baru123!'
//
// Password TIDAK dicetak ke stdout/log. Hanya email + status yang ditampilkan.
package main

import (
	"flag"
	"fmt"
	"os"
	"regexp"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

func main() {
	email := flag.String("email", "", "email akun yang password-nya dirotasi")
	password := flag.String("password", "", "password baru (minimal 12 karakter)")
	flag.Parse()

	if *email == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "wajib: -email dan -password")
		os.Exit(2)
	}
	if !emailRe.MatchString(*email) {
		fmt.Fprintln(os.Stderr, "email tidak valid")
		os.Exit(2)
	}
	if len(*password) < 12 {
		fmt.Fprintln(os.Stderr, "password minimal 12 karakter")
		os.Exit(2)
	}
	if len(*password) < 12 {
		fmt.Fprintln(os.Stderr, "password minimal 12 karakter")
		os.Exit(2)
	}

	cfg := config.LoadConfig()
	if _, err := database.InitDB(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "gagal koneksi database: %v\n", err)
		os.Exit(1)
	}

	var user models.User
	err := database.DB.Where("LOWER(email) = ?", toLower(*email)).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			fmt.Fprintf(os.Stderr, "akun tidak ditemukan: %s\n", *email)
		} else {
			fmt.Fprintf(os.Stderr, "error query: %v\n", err)
		}
		os.Exit(1)
	}

	if err := user.SetPassword(*password); err != nil {
		fmt.Fprintf(os.Stderr, "gagal hash password: %v\n", err)
		os.Exit(1)
	}

	// Simpan hanya kolom password agar tidak menimpa perubahan lain.
	if err := database.DB.Model(&models.User{}).Where("id = ?", user.ID).
		Update("password", user.Password).Error; err != nil {
		fmt.Fprintf(os.Stderr, "gagal menyimpan: %v\n", err)
		os.Exit(1)
	}

	// Cabut semua sesi aktif user ini: password berganti = token lama harus mati.
	revoked := database.DB.Exec(
		"UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", user.ID)
	if revoked.Error != nil {
		fmt.Fprintf(os.Stderr, "peringatan: gagal mencabut sesi lama: %v\n", revoked.Error)
	}

	fmt.Printf("OK: password dirotasi untuk %s (user_id=%d)\n", user.Email, user.ID)
}

func toLower(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
		}
	}
	return string(b)
}

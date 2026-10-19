package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	listFlag := flag.Bool("list", false, "Daftar semua pengguna dan role mereka")
	emailFlag := flag.String("email", "", "Email akun super admin")
	nameFlag := flag.String("name", "Super Administrator", "Nama akun super admin")
	passwordFlag := flag.String("password", "", "Password akun super admin")
	flag.Parse()

	cfg := config.LoadConfig()
	db, err := gorm.Open(postgres.Open(cfg.GetPostgresDSN()), &gorm.Config{})
	if err != nil {
		fmt.Printf("Gagal koneksi ke PostgreSQL: %v\n", err)
		os.Exit(1)
	}

	if *listFlag || (*emailFlag == "" && *passwordFlag == "") {
		var users []models.User
		if err := db.Order("id asc").Find(&users).Error; err != nil {
			fmt.Printf("Gagal mengambil data user: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("\n=== DAFTAR PENGGUNA SISTEM CATAVOR (Total: %d) ===\n", len(users))
		fmt.Printf("%-5s | %-32s | %-20s | %-14s | %s\n", "ID", "EMAIL", "NAMA", "ROLE", "STATUS")
		fmt.Println(strings.Repeat("-", 85))
		for _, u := range users {
			status := "Aktif"
			if u.IsBlacklisted {
				status = "Blacklisted"
			}
			fmt.Printf("%-5d | %-32s | %-20s | %-14s | %s\n", u.ID, u.Email, u.Name, u.PlatformRole, status)
		}
		fmt.Println()
		if *emailFlag == "" {
			return
		}
	}

	email := strings.TrimSpace(strings.ToLower(*emailFlag))
	if email == "" {
		fmt.Println("Parameter -email wajib diisi untuk membuat atau memperbarui super admin.")
		return
	}

	password := strings.TrimSpace(*passwordFlag)
	if password == "" {
		fmt.Println("Parameter -password wajib diisi.")
		return
	}

	var user models.User
	err = db.Where("LOWER(email) = ?", email).First(&user).Error
	now := time.Now().UTC()

	if err == nil {
		// Existing user
		if err := user.SetPassword(password); err != nil {
			fmt.Printf("Gagal hash password: %v\n", err)
			os.Exit(1)
		}
		user.PlatformRole = "superadmin"
		user.IsBlacklisted = false
		user.EmailVerifiedAt = &now
		user.IsPasswordChanged = true
		user.HasCustomPassword = true
		user.TokenVersion++

		if *nameFlag != "" && *nameFlag != "Super Administrator" {
			user.Name = *nameFlag
		}

		if err := db.Save(&user).Error; err != nil {
			fmt.Printf("Gagal update user: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("\n[BERHASIL] User ID #%d (%s) berhasil ditingkatkan menjadi SUPER ADMIN!\n", user.ID, user.Email)
	} else if err == gorm.ErrRecordNotFound {
		// New user
		name := strings.TrimSpace(*nameFlag)
		if name == "" {
			name = "Super Administrator"
		}
		user = models.User{
			Name:              name,
			Email:             email,
			EmailVerifiedAt:   &now,
			PlatformRole:      "superadmin",
			IsBlacklisted:     false,
			IsPasswordChanged: true,
			HasCustomPassword: true,
			TokenVersion:      1,
		}
		if err := user.SetPassword(password); err != nil {
			fmt.Printf("Gagal hash password: %v\n", err)
			os.Exit(1)
		}
		if err := db.Create(&user).Error; err != nil {
			fmt.Printf("Gagal membuat user baru: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("\n[BERHASIL] Akun Super Admin baru berhasil dibuat dengan ID #%d (%s)!\n", user.ID, user.Email)
	} else {
		fmt.Printf("Query error: %v\n", err)
		os.Exit(1)
	}
}

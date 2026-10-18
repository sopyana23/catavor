package handlers

import (
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// logAuthEvent mencatat peristiwa autentikasi ke audit log platform (N-35).
//
// Sebelum ini, login sukses/gagal tidak pernah masuk activity log sehingga
// tidak ada jejak governansi "siapa masuk kapan dari mana" -- hanya
// user_sessions yang merekam IP/UA untuk keperluan forensik. Helper ini
// menyatukan pencatatan agar kelima titik login (kredensial, Google, pasca
// registrasi, verifikasi OTP) berperilaku sama tanpa menduplikasi logika.
//
// PRINSIP KEAMANAN: JANGAN pernah menaruh password, token, OTP, atau hash
// apa pun ke dalam Changes/Description. Audit log dibaca admin dan bisa
// diekspor, jadi hanya metadata non-sensitif yang boleh masuk.
func logAuthEvent(c *fiber.Ctx, action, description string, user *models.User, extra map[string]interface{}) {
	if database.DB == nil {
		return
	}

	changes := map[string]interface{}{}
	for k, v := range extra {
		changes[k] = v
	}

	params := services.RecordActivityParams{
		DB:          database.DB,
		Action:      action,
		Category:    "security",
		EntityType:  "user",
		Description: description,
		Changes:     changes,
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
		ActorRole:   "system",
	}

	if user != nil {
		uid := user.ID
		params.UserID = &uid
		params.EntityID = &uid
		params.ActorName = user.Name
		params.ActorEmail = user.Email
		params.EntityTitle = user.Email
		if user.PlatformRole != "" {
			params.ActorRole = user.PlatformRole
		}
	}

	services.RecordActivity(params)
}

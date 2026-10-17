package models

import "time"

// PublicStoreView adalah representasi toko yang AMAN untuk dibaca pengunjung
// tanpa login (storefront publik).
//
// SECURITY (N-08): sebelumnya handler publik (mis. GET /api/products/:id)
// mengirim seluruh models.Store lewat relasi Preload("Store"), sehingga
// pengunjung anonim bisa membaca data operasional internal: is_blacklisted,
// suspension_reason, is_suspended, plan/plan_status, storage_used_bytes,
// dormancy_status, last_activity_at, dan user_id pemilik toko.
//
// DTO ini whitelist eksplisit: field yang boleh tampil di storefront saja.
// Field baru pada models.Store TIDAK otomatis bocor ke publik.
type PublicStoreView struct {
	ID             uint      `json:"id"`
	Slug           string    `json:"slug"`
	StoreTitle     string    `json:"store_title"`
	StoreSlogan    string    `json:"store_slogan"`
	PromoBanner    string    `json:"promo_banner"`
	WhatsappNumber string    `json:"whatsapp_number"`
	OfficialWebsite string   `json:"official_website"`
	StoreLogoURL   string    `json:"store_logo_url"`
	StoreTheme     string    `json:"store_theme"`
	AboutTitle     string    `json:"about_title"`
	AboutSlogan    string    `json:"about_slogan"`
	AboutDescription string  `json:"about_description"`
	AboutCards     string    `json:"about_cards,omitempty"`
	AboutLocation  string    `json:"about_location"`
	AboutHours     string    `json:"about_hours"`
	ShowHours      bool      `json:"show_hours"`
	AboutDisclaimer string   `json:"about_disclaimer"`
	SocialLinks    string    `json:"social_links,omitempty"`
	EnableWADirect bool      `json:"enable_wa_direct"`
	EnableWARekber bool      `json:"enable_wa_rekber"`
	CreatedAt      time.Time `json:"created_at"`
}

// ToPublicView memetakan store ke representasi publik yang aman.
// Mengembalikan nil bila store nil, agar pemanggil bisa memakai `omitempty`.
func (s *Store) ToPublicView() *PublicStoreView {
	if s == nil {
		return nil
	}
	return &PublicStoreView{
		ID:               s.ID,
		Slug:             s.Slug,
		StoreTitle:       s.StoreTitle,
		StoreSlogan:      s.StoreSlogan,
		PromoBanner:      s.PromoBanner,
		WhatsappNumber:   s.WhatsappNumber,
		OfficialWebsite:  s.OfficialWebsite,
		StoreLogoURL:     s.StoreLogoURL,
		StoreTheme:       s.StoreTheme,
		AboutTitle:       s.AboutTitle,
		AboutSlogan:      s.AboutSlogan,
		AboutDescription: s.AboutDescription,
		AboutCards:       string(s.AboutCards),
		AboutLocation:    s.AboutLocation,
		AboutHours:       s.AboutHours,
		ShowHours:        s.ShowHours,
		AboutDisclaimer:  s.AboutDisclaimer,
		SocialLinks:      string(s.SocialLinks),
		EnableWADirect:   s.EnableWADirect,
		EnableWARekber:   s.EnableWARekber,
		CreatedAt:        s.CreatedAt,
	}
}

package services

import (
	"catavor-backend/internal/models"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func resolveFriendlyPlanName(db *gorm.DB, planCode string) string {
	clean := strings.ToLower(strings.TrimSpace(planCode))
	if db != nil && clean != "" {
		if p, err := getPlanByCodeStrict(db, clean); err == nil && p != nil && strings.TrimSpace(p.Name) != "" {
			return p.Name
		}
	}
	switch clean {
	case "pro_business":
		return "Pro Bisnis"
	case "pro_starter", "pro":
		return "Pro Starter"
	default:
		return "Gratis Terbatas"
	}
}

// CreateStoreSystemNotification persists a single-store notification idempotently and optionally pushes SSE.
func CreateStoreSystemNotification(db *gorm.DB, notif models.Notification, broadcast bool) (bool, error) {
	if db == nil || !db.Migrator().HasTable(&models.Notification{}) {
		return false, nil
	}
	if strings.TrimSpace(notif.ID) == "" {
		return false, fmt.Errorf("notification id is required")
	}
	now := time.Now().UTC()
	if notif.CreatedAt.IsZero() {
		notif.CreatedAt = now
	}
	if notif.UpdatedAt.IsZero() {
		notif.UpdatedAt = now
	}
	if notif.PublishedAt == nil {
		pub := notif.CreatedAt
		notif.PublishedAt = &pub
	}
	notif.TargetType = "single_store"
	notif.Status = "published"
	if notif.RetentionHours <= 0 {
		notif.RetentionHours = 168
	}

	res := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(&notif)
	if res.Error != nil {
		return false, res.Error
	}
	inserted := res.RowsAffected > 0
	if inserted && broadcast {
		GetNotificationHub().Broadcast(&notif)
	}
	return inserted, nil
}

// EnsureStoreOnboardingNotifications seeds deterministic, plan-specific onboarding notifications for a store.
func EnsureStoreOnboardingNotifications(db *gorm.DB, store *models.Store, pendingOrder *models.SubscriptionOrder) {
	if db == nil || store == nil || store.ID == 0 || !db.Migrator().HasTable(&models.Notification{}) {
		return
	}

	planCode := strings.ToLower(strings.TrimSpace(store.Plan))
	if planCode == "" {
		planCode = "free"
	}
	plan, _ := GetPlanByCode(db, planCode)
	planName := resolveFriendlyPlanName(db, planCode)
	maxItems := 15
	var storageBytes int64 = 100 * 1024 * 1024
	if plan != nil {
		maxItems = plan.MaxItems
		if plan.StorageLimitBytes > 0 {
			storageBytes = plan.StorageLimitBytes
		}
	}

	now := time.Now().UTC()

	// Fallback query: if caller did not pass pendingOrder, inspect active pending invoice so GET /notifications on first login sees it cleanly.
	if pendingOrder == nil && db.Migrator().HasTable(&models.SubscriptionOrder{}) {
		var found models.SubscriptionOrder
		if err := db.Where("store_id = ? AND payment_status IN ?", store.ID, []string{"pending", "pending_verification"}).
			Order("created_at DESC, id DESC").First(&found).Error; err == nil {
			pendingOrder = &found
		}
	}

	var welcomeNotif models.Notification
	if pendingOrder != nil {
		targetName := resolveFriendlyPlanName(db, pendingOrder.PlanCode)
		isVerifying := strings.EqualFold(strings.TrimSpace(pendingOrder.PaymentStatus), "pending_verification")
		statusLabel := "Menunggu Pembayaran"
		statusSummary := fmt.Sprintf("Invoice %s untuk paket %s (%s) menunggu penyelesaian pembayaran.", pendingOrder.OrderNumber, targetName, formatEmailRupiah(pendingOrder.FinalAmount))
		if isVerifying {
			statusLabel = "Dalam Verifikasi Tim Finance (Est. 1x24 Jam)"
			statusSummary = fmt.Sprintf("Bukti pembayaran invoice %s untuk paket %s (%s) telah diterima dan sedang diverifikasi Tim Finance.", pendingOrder.OrderNumber, targetName, formatEmailRupiah(pendingOrder.FinalAmount))
		}
		welcomeNotif = models.Notification{
			ID:             fmt.Sprintf("notif_welcome_%d", store.ID),
			TargetType:     "single_store",
			TargetID:       store.ID,
			Title:          fmt.Sprintf("Status Pembayaran Paket %s: %s", targetName, statusLabel),
			Category:       "TAGIHAN",
			Message:        fmt.Sprintf("%s Selama proses berlangsung, katalog Anda aktif sementara di paket %s sehingga sudah bisa digunakan.", statusSummary, planName),
			DetailContent:  fmt.Sprintf("Selamat datang di Catavor! Katalog \"%s\" telah aktif dan dapat langsung dikelola.\n\nStatus Transaksi Langganan:\n• Nomor Invoice: %s\n• Paket Tujuan: %s\n• Total Tagihan: %s\n• Status Saat Ini: %s\n\nAkses Sementara Selama Verifikasi:\nToko Anda sementara menggunakan kapasitas paket %s (%s, %s penyimpanan). Setelah Tim Finance menyetujui transaksi ini, paket akan langsung beralih otomatis ke %s dan pemberitahuan resmi akan dikirimkan ke email serta dashboard Anda.", store.StoreTitle, pendingOrder.OrderNumber, targetName, formatEmailRupiah(pendingOrder.FinalAmount), statusLabel, planName, formatEmailQuotaItems(maxItems), formatEmailStorageLimit(storageBytes), targetName),
			Type:           "warning",
			ActionEnabled:  true,
			ActionType:     "detail",
			LinkSubTab:     "subscription",
			ActionLabel:    "Lihat Status Pembayaran ->",
			RetentionHours: 720,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
	} else {
		switch planCode {
		case "pro_business":
			welcomeNotif = models.Notification{
				ID:                    fmt.Sprintf("notif_welcome_%d", store.ID),
				TargetType:            "single_store",
				TargetID:              store.ID,
				Title:                 "Selamat Datang di Paket Pro Bisnis Catavor",
				Category:              "LANGGANAN",
				Message:               "Katalog Anda aktif dengan kapasitas Tanpa Batas item, 10 GB media, 100% bebas iklan sponsor, Custom Domain, dan Dukungan Prioritas VIP.",
				DetailContent:         fmt.Sprintf("Selamat datang di Catavor! Toko \"%s\" Anda telah aktif di tier tertinggi Pro Bisnis.\n\nFasilitas yang tersedia untuk Anda:\n• Kuota Produk: Tanpa Batas (Unlimited) dengan 10 foto HD per produk.\n• Penyimpanan Media: 10 GB untuk gambar dan materi katalog.\n• Etalase Bebas Iklan & Lencana Terverifikasi resmi.\n• Custom Domain pribadi dan jalur Dukungan Prioritas VIP.", store.StoreTitle),
				Type:                  "success",
				ActionEnabled:         true,
				ActionType:            "detail",
				LinkSubTab:            "settings",
				LinkMobileSettingsTab: "domain",
				ActionLabel:           "Atur Custom Domain & Fitur Bisnis ->",
				RetentionHours:        720,
				CreatedAt:             now,
				UpdatedAt:             now,
			}
		case "pro_starter":
			welcomeNotif = models.Notification{
				ID:             fmt.Sprintf("notif_welcome_%d", store.ID),
				TargetType:     "single_store",
				TargetID:       store.ID,
				Title:          "Selamat Datang di Paket Pro Starter Catavor",
				Category:       "LANGGANAN",
				Message:        "Katalog Anda kini aktif di Pro Starter dengan kuota 150 produk, 2 GB penyimpanan, bebas iklan sponsor, dan Lencana Terverifikasi.",
				DetailContent:  fmt.Sprintf("Selamat datang di Catavor! Toko \"%s\" Anda aktif pada paket Pro Starter.\n\nKeunggulan yang langsung terbuka:\n• Kuota Produk: 150 item aktif dengan hingga 10 foto HD per item.\n• Penyimpanan Media: 2 GB.\n• 100%% bebas iklan sponsor di seluruh etalase katalog toko.\n• Lencana Terverifikasi dan prioritas di direktori pencarian.", store.StoreTitle),
				Type:           "success",
				ActionEnabled:  true,
				ActionType:     "detail",
				LinkSubTab:     "subscription",
				ActionLabel:    "Lihat Detail Paket Pro Starter ->",
				RetentionHours: 720,
				CreatedAt:      now,
				UpdatedAt:      now,
			}
		default:
			welcomeNotif = models.Notification{
				ID:             fmt.Sprintf("notif_welcome_%d", store.ID),
				TargetType:     "single_store",
				TargetID:       store.ID,
				Title:          "Selamat Datang di Catavor (Paket Gratis Terbatas)",
				Category:       "PANDUAN",
				Message:        fmt.Sprintf("Katalog \"%s\" siap digunakan dengan kuota %s dan %s penyimpanan. Anda dapat upgrade ke Pro kapan saja tanpa kehilangan data.", store.StoreTitle, formatEmailQuotaItems(maxItems), formatEmailStorageLimit(storageBytes)),
				DetailContent:  fmt.Sprintf("Selamat datang di platform katalog digital Catavor!\n\nRingkasan Paket Gratis Terbatas:\n• Kapasitas Katalog: Maksimal %s dengan hingga 10 foto HD per produk.\n• Penyimpanan Media: %s.\n• Etalase publik langsung aktif dan dapat menerima pesanan WhatsApp.\n\nTips Mulai Cepat:\n1. Lengkapi alamat dan jam operasional di menu Tentang Kami.\n2. Tambahkan produk pertama Anda di menu Daftar Item.\n3. Tingkatkan ke Pro Starter atau Pro Bisnis kapan saja dari menu Langganan untuk membuka kuota lebih besar dan etalase 100%% bebas iklan.", formatEmailQuotaItems(maxItems), formatEmailStorageLimit(storageBytes)),
				Type:           "info",
				ActionEnabled:  true,
				ActionType:     "detail",
				LinkSubTab:     "subscription",
				ActionLabel:    "Lihat Ringkasan Kuota & Paket ->",
				RetentionHours: 720,
				CreatedAt:      now,
				UpdatedAt:      now,
			}
		}
	}

	shareDetail := "Katalog bisnis Anda kini telah aktif dan dapat diakses oleh publik secara instan.\n\nFitur Bagikan Katalog memungkinkan Anda untuk:\n• Membagikan tautan link langsung ke media sosial (WhatsApp, Instagram Bio, TikTok, dan Facebook).\n• Mengunduh Poster QR Code beresolusi tinggi untuk dicetak dan dipajang di meja kasir, etalase toko, atau kartu nama bisnis Anda.\n• Memantau trafik pengunjung dan total klik katalog secara realtime di dashboard analitik."
	if planCode == "pro_business" {
		shareDetail += "\n\nKhusus Pro Bisnis: Hubungkan Custom Domain pribadi agar tautan yang dibagikan memakai nama domain brand Anda sendiri."
	}

	inventoryMsg := fmt.Sprintf("Akses cepat ke menu inventaris untuk menambah produk baru (kapasitas paket %s: %s), mengubah varian, atau memperbarui harga jual.", planName, formatEmailQuotaItems(maxItems))

	guides := []models.Notification{
		welcomeNotif,
		{
			ID:                    fmt.Sprintf("notif_about_%d", store.ID),
			TargetType:            "single_store",
			TargetID:              store.ID,
			Title:                 "Panduan Kelengkapan Halaman Tentang Kami",
			Category:              "PANDUAN",
			Message:               "Lengkapi Alamat Bisnis, Jam Operasional, dan Profil Komitmen Layanan Anda agar profil katalog terlihat profesional dan terpercaya di mata pembeli.",
			DetailContent:         "Halaman Tentang Kami adalah wajah utama brand profil bisnis Anda di mata pembeli. Untuk membangun kepercayaan maksimal pelanggan baru, pastikan Anda melengkapi:\n\n1. Alamat Bisnis & Titik Maps:\nMempermudah calon pelanggan menemukan lokasi fisik toko, workshop, atau titik penjemputan pesanan.\n\n2. Jam Operasional Toko:\nJadwal buka dan jam operasional harian dalam melayani pesanan atau chat pelanggan.\n\n3. Profil Komitmen Layanan & Garansi:\nPenjelasan jaminan kualitas produk, keaslian barang, serta standar pelayanan terbaik toko Anda.\n\nKlik tombol di bawah untuk langsung menuju formulir pengaturan Tentang Kami.",
			Type:                  "warning",
			ActionEnabled:         true,
			ActionType:            "detail",
			LinkSubTab:            "settings",
			LinkMobileSettingsTab: "about",
			ActionLabel:           "Buka Pengaturan Tentang Kami ->",
			RetentionHours:        168,
			CreatedAt:             now.Add(-2 * time.Minute),
			UpdatedAt:             now.Add(-2 * time.Minute),
		},
		{
			ID:             fmt.Sprintf("notif_share_%d", store.ID),
			TargetType:     "single_store",
			TargetID:       store.ID,
			Title:          "Fitur Bagikan Katalog & QR Code Bisnis",
			Category:       "PROMOSI",
			Message:        "Katalog digital Anda kini telah aktif! Bagikan tautan resmi atau unduh QR Code dinamis untuk mulai menjangkau pembeli di berbagai platform.",
			DetailContent:  shareDetail,
			Type:           "success",
			ActionEnabled:  true,
			ActionType:     "detail",
			LinkSubTab:     "share",
			ActionLabel:    "Buka Menu Bagikan Katalog ->",
			RetentionHours: 168,
			CreatedAt:      now.Add(-5 * time.Minute),
			UpdatedAt:      now.Add(-5 * time.Minute),
		},
		{
			ID:             fmt.Sprintf("notif_inventory_%d", store.ID),
			TargetType:     "single_store",
			TargetID:       store.ID,
			Title:          "Kelola Stok & Inventaris Produk",
			Category:       "INVENTARIS",
			Message:        inventoryMsg,
			Type:           "order",
			ActionEnabled:  true,
			ActionType:     "navigate",
			LinkSubTab:     "items",
			ActionLabel:    "Buka Daftar Item Katalog ->",
			RetentionHours: 168,
			CreatedAt:      now.Add(-15 * time.Minute),
			UpdatedAt:      now.Add(-15 * time.Minute),
		},
	}

	insertedCount := 0
	for _, g := range guides {
		if inserted, err := CreateStoreSystemNotification(db, g, false); err == nil && inserted {
			insertedCount++
		}
	}

	if insertedCount > 0 {
		GetAutomationTracker().RecordLog(servicesLogOnboardingEntry(store.ID, insertedCount))
		GetAutomationTracker().RecordWorkerHeartbeat(
			"onboarding_engine",
			"running",
			fmt.Sprintf("Panduan onboarding (%d item, paket %s) disematkan ke Toko #%d.", insertedCount, planName, store.ID),
			"",
			int64(insertedCount),
			time.Now().UTC().Add(1*time.Hour),
		)
	}
}

func servicesLogOnboardingEntry(storeID uint, count int) AutomationLogEntry {
	return AutomationLogEntry{
		BotName:     "onboarding_engine",
		TriggerType: "event_hook",
		BotTitle:    "Bot Panduan Onboarding Toko Baru",
		Target:      fmt.Sprintf("Toko #%d", storeID),
		TargetID:    storeID,
		Action:      "sent_in_app",
		Status:      "success",
		Details:     fmt.Sprintf("%d artikel panduan onboarding sesuai paket disematkan ke katalog toko #%d.", count, storeID),
		Timestamp:   time.Now().UTC(),
	}
}

func enqueueEmailIfSupported(db *gorm.DB, recipientEmail, recipientName, fromName, subject, bodyHTML, category, referenceID string) {
	if db == nil || strings.TrimSpace(recipientEmail) == "" || !db.Migrator().HasTable(&models.EmailJob{}) {
		return
	}
	_, _ = EnqueueLifecycleEmailOnce(db, recipientEmail, recipientName, fromName, subject, bodyHTML, category, referenceID)
}

func loadStoreAndOwner(db *gorm.DB, storeID uint) (*models.Store, *models.User) {
	if db == nil || storeID == 0 {
		return nil, nil
	}
	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, nil
	}
	var user models.User
	if err := db.First(&user, store.UserID).Error; err != nil {
		return &store, nil
	}
	return &store, &user
}

// DispatchRegistrationOnboarding seeds plan-specific in-app notifications and enqueues the welcome / pending payment email.
func DispatchRegistrationOnboarding(db *gorm.DB, user *models.User, store *models.Store, order *models.SubscriptionOrder) {
	if db == nil || store == nil || store.ID == 0 {
		return
	}
	var pendingOrder *models.SubscriptionOrder
	if order != nil && order.PaymentStatus != "paid" {
		pendingOrder = order
	}
	EnsureStoreOnboardingNotifications(db, store, pendingOrder)

	if user == nil || strings.TrimSpace(user.Email) == "" {
		return
	}
	planCode := strings.ToLower(strings.TrimSpace(store.Plan))
	if planCode == "" {
		planCode = "free"
	}
	plan, _ := GetPlanByCode(db, planCode)
	planName := resolveFriendlyPlanName(db, planCode)
	maxItems := 15
	var storageBytes int64 = 100 * 1024 * 1024
	if plan != nil {
		maxItems = plan.MaxItems
		if plan.StorageLimitBytes > 0 {
			storageBytes = plan.StorageLimitBytes
		}
	}
	targetPlanName := planName
	if pendingOrder != nil {
		targetPlanName = resolveFriendlyPlanName(db, pendingOrder.PlanCode)
	}

	subj, body := BuildWelcomeStoreEmail(
		user.Name,
		store.StoreTitle,
		store.Slug,
		planCode,
		planName,
		maxItems,
		storageBytes,
		pendingOrder,
		targetPlanName,
	)
	enqueueEmailIfSupported(db, user.Email, user.Name, "Catavor", subj, body, "welcome_onboarding", fmt.Sprintf("welcome_store_%d", store.ID))
}

// DispatchSubscriptionOrderPending emits in-app + email notifications when a subscription invoice is awaiting payment or finance verification.
func DispatchSubscriptionOrderPending(db *gorm.DB, order *models.SubscriptionOrder) {
	if db == nil || order == nil || order.ID == 0 {
		return
	}
	store, user := loadStoreAndOwner(db, order.StoreID)
	if store == nil {
		return
	}
	targetName := resolveFriendlyPlanName(db, order.PlanCode)
	isVerif := strings.EqualFold(strings.TrimSpace(order.PaymentStatus), "pending_verification")

	title := fmt.Sprintf("Tagihan %s Menunggu Pembayaran (%s)", targetName, order.OrderNumber)
	msg := fmt.Sprintf("Invoice %s sebesar %s untuk paket %s telah dibuat. Selesaikan pembayaran sebelum batas waktu berakhir.", order.OrderNumber, formatEmailRupiah(order.FinalAmount), targetName)
	if isVerif {
		title = fmt.Sprintf("Pembayaran %s Sedang Diverifikasi (%s)", targetName, order.OrderNumber)
		msg = fmt.Sprintf("Bukti pembayaran invoice %s sebesar %s telah diterima dan sedang diverifikasi Tim Finance (estimasi 1x24 jam).", order.OrderNumber, formatEmailRupiah(order.FinalAmount))
	}
	detail := fmt.Sprintf("Rincian Tagihan Langganan:\n• Nomor Invoice: %s\n• Paket Tujuan: %s\n• Total Tagihan: %s\n• Status: %s", order.OrderNumber, targetName, formatEmailRupiah(order.FinalAmount), orderPaymentStatusLabel(order))

	now := time.Now().UTC()
	_, _ = CreateStoreSystemNotification(db, models.Notification{
		ID:             fmt.Sprintf("notif_sub_pending_%d", order.ID),
		TargetType:     "single_store",
		TargetID:       store.ID,
		Title:          title,
		Category:       "TAGIHAN",
		Message:        msg,
		DetailContent:  detail,
		Type:           "warning",
		ActionEnabled:  true,
		ActionType:     "detail",
		LinkSubTab:     "subscription",
		ActionLabel:    "Lihat Status Tagihan ->",
		RetentionHours: 720,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, true)

	if user != nil && strings.TrimSpace(user.Email) != "" {
		subj, body := BuildSubscriptionOrderPendingEmail(user.Name, store.StoreTitle, store.Slug, order, targetName)
		enqueueEmailIfSupported(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_order_pending", fmt.Sprintf("sub_pending_%d", order.ID))
	}
}

// DispatchSubscriptionOrderActivated emits in-app + email notifications when a subscription invoice is confirmed and plan features unlock.
func DispatchSubscriptionOrderActivated(db *gorm.DB, order *models.SubscriptionOrder, plan *models.SubscriptionPlan, expiresAt *time.Time) {
	if db == nil || order == nil || order.ID == 0 {
		return
	}
	store, user := loadStoreAndOwner(db, order.StoreID)
	if store == nil {
		return
	}
	if plan == nil {
		plan, _ = GetPlanByCode(db, order.PlanCode)
	}
	planName := resolveFriendlyPlanName(db, order.PlanCode)
	validUntil := "30 hari ke depan"
	if expiresAt != nil {
		validUntil = expiresAt.In(time.FixedZone("WIB", 7*3600)).Format("02 January 2006")
	}

	linkTab := "subscription"
	linkMobileSettings := ""
	actionLabel := "Lihat Detail Paket Aktif ->"
	if strings.EqualFold(strings.TrimSpace(order.PlanCode), "pro_business") {
		linkTab = "settings"
		linkMobileSettings = "domain"
		actionLabel = "Atur Custom Domain & Fitur Bisnis ->"
	}

	now := time.Now().UTC()
	_, _ = CreateStoreSystemNotification(db, models.Notification{
		ID:                    fmt.Sprintf("notif_sub_active_%d", order.ID),
		TargetType:            "single_store",
		TargetID:              store.ID,
		Title:                 fmt.Sprintf("Pembayaran Disetujui: Paket %s Aktif", planName),
		Category:              "LANGGANAN",
		Message:               fmt.Sprintf("Invoice %s telah dikonfirmasi. Katalog \"%s\" kini menikmati paket %s sampai %s.", order.OrderNumber, store.StoreTitle, planName, validUntil),
		DetailContent:         fmt.Sprintf("Pembayaran Anda untuk invoice %s (%s) telah diverifikasi.\n\nRingkasan Aktivasi:\n• Paket Aktif: %s\n• Berlaku Hingga: %s\n• Seluruh kuota dan fitur paket %s kini otomatis terbuka.", order.OrderNumber, formatEmailRupiah(order.FinalAmount), planName, validUntil, planName),
		Type:                  "success",
		ActionEnabled:         true,
		ActionType:            "detail",
		LinkSubTab:            linkTab,
		LinkMobileSettingsTab: linkMobileSettings,
		ActionLabel:           actionLabel,
		RetentionHours:        720,
		CreatedAt:             now,
		UpdatedAt:             now,
	}, true)

	if user != nil && strings.TrimSpace(user.Email) != "" {
		subj, body := BuildSubscriptionActivatedEmail(user.Name, store.StoreTitle, store.Slug, order, plan, expiresAt)
		enqueueEmailIfSupported(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_activated", fmt.Sprintf("sub_active_%d", order.ID))
	}
}

// DispatchSubscriptionOrderRejected emits in-app + email notifications when Finance rejects a subscription payment.
func DispatchSubscriptionOrderRejected(db *gorm.DB, order *models.SubscriptionOrder) {
	if db == nil || order == nil || order.ID == 0 {
		return
	}
	store, user := loadStoreAndOwner(db, order.StoreID)
	if store == nil {
		return
	}
	targetName := resolveFriendlyPlanName(db, order.PlanCode)
	reason := strings.TrimSpace(order.RejectionReason)
	if reason == "" {
		reason = "Bukti transfer belum sesuai atau dana belum tercatat."
	}

	now := time.Now().UTC()
	_, _ = CreateStoreSystemNotification(db, models.Notification{
		ID:             fmt.Sprintf("notif_sub_rejected_%d", order.ID),
		TargetType:     "single_store",
		TargetID:       store.ID,
		Title:          fmt.Sprintf("Verifikasi Tagihan %s Ditolak", order.OrderNumber),
		Category:       "TAGIHAN",
		Message:        fmt.Sprintf("Pembayaran paket %s belum dapat disetujui: %s", targetName, reason),
		DetailContent:  fmt.Sprintf("Tim Finance meninjau invoice %s (%s) namun belum dapat menyetujui pembayaran.\n\nAlasan: %s\n\nSilakan ajukan ulang tagihan melalui menu Paket & Langganan dengan bukti pembayaran yang jelas.", order.OrderNumber, targetName, reason),
		Type:           "warning",
		ActionEnabled:  true,
		ActionType:     "detail",
		LinkSubTab:     "subscription",
		ActionLabel:    "Tinjau Tagihan & Ajukan Ulang ->",
		RetentionHours: 720,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, true)

	if user != nil && strings.TrimSpace(user.Email) != "" {
		subj, body := BuildSubscriptionOrderRejectedEmail(user.Name, store.StoreTitle, store.Slug, order, targetName)
		enqueueEmailIfSupported(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_rejected", fmt.Sprintf("sub_rejected_%d", order.ID))
	}
}

// DispatchSubscriptionOrderExpired emits in-app + email notifications when an unpaid invoice expires.
func DispatchSubscriptionOrderExpired(db *gorm.DB, order *models.SubscriptionOrder) {
	if db == nil || order == nil || order.ID == 0 {
		return
	}
	store, user := loadStoreAndOwner(db, order.StoreID)
	if store == nil {
		return
	}
	targetName := resolveFriendlyPlanName(db, order.PlanCode)

	now := time.Now().UTC()
	_, _ = CreateStoreSystemNotification(db, models.Notification{
		ID:             fmt.Sprintf("notif_sub_expired_%d", order.ID),
		TargetType:     "single_store",
		TargetID:       store.ID,
		Title:          fmt.Sprintf("Tagihan %s Kedaluwarsa", order.OrderNumber),
		Category:       "TAGIHAN",
		Message:        fmt.Sprintf("Invoice %s untuk paket %s melewati batas waktu pembayaran. Silakan buat tagihan baru jika masih ingin meningkatkan paket.", order.OrderNumber, targetName),
		DetailContent:  fmt.Sprintf("Batas waktu pembayaran invoice %s (%s) telah berakhir.\n\nOperasional katalog Anda tetap berjalan normal sesuai paket aktif saat ini. Anda dapat membuat invoice baru kapan saja di menu Paket & Langganan.", order.OrderNumber, targetName),
		Type:           "info",
		ActionEnabled:  true,
		ActionType:     "detail",
		LinkSubTab:     "subscription",
		ActionLabel:    "Buat Tagihan Baru ->",
		RetentionHours: 720,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, true)

	if user != nil && strings.TrimSpace(user.Email) != "" {
		subj, body := BuildSubscriptionOrderExpiredEmail(user.Name, store.StoreTitle, store.Slug, order, targetName)
		enqueueEmailIfSupported(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_expired", fmt.Sprintf("sub_expired_%d", order.ID))
	}
}

// DispatchSubscriptionLifecycleInApp records an in-app notification alongside lifecycle email dispatches.
func DispatchSubscriptionLifecycleInApp(db *gorm.DB, storeID uint, notifID, title, category, message, detail, notifType, actionLabel string) {
	if db == nil || storeID == 0 || strings.TrimSpace(notifID) == "" {
		return
	}
	now := time.Now().UTC()
	_, _ = CreateStoreSystemNotification(db, models.Notification{
		ID:             notifID,
		TargetType:     "single_store",
		TargetID:       storeID,
		Title:          title,
		Category:       category,
		Message:        message,
		DetailContent:  detail,
		Type:           notifType,
		ActionEnabled:  true,
		ActionType:     "detail",
		LinkSubTab:     "subscription",
		ActionLabel:    actionLabel,
		RetentionHours: 720,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, true)
}

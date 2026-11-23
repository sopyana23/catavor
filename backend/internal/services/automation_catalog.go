package services

// Static capabilities describe the work. Runtime timestamps are populated only by observations.
func automationWorkers() map[string]*WorkerStatus {
	type definition struct {
		id, title, category, schedule, conditions string
		manual                                    bool
	}
	definitions := []definition{
		{"store_expiry", "Pemeriksaan dormansi toko (alias)", "lifecycle", "Manual", "Menggunakan siklus dormansi Free, termasuk penghapusan permanen setelah 60 hari.", true},
		{"dormancy_worker", "Dormansi toko Free", "lifecycle", "Setiap jam", "Toko Free tanpa pengecualian. Peringatan hari 30 dan 38, suspensi hari 45, penghapusan katalog berdasarkan ID toko pada hari 60. Akun pemilik dan toko lainnya tetap tersedia.", true},
		{"promo_expiry", "Hitung toko dengan banner promo", "diagnostik", "Manual", "Menghitung toko yang memiliki banner. Hasil berupa jumlah toko saat pemeriksaan.", true},
		{"flash_sale", "Hitung produk aktif", "diagnostik", "Manual", "Menghitung produk aktif pada saat pemeriksaan.", true},
		{"weekly_summary", "Ringkasan platform saat ini", "diagnostik", "Manual", "Menghitung toko, pengguna, produk aktif dan tiket terbuka saat diminta.", true},
		{"support_lifecycle", "Siklus helpdesk dan SLA", "support", "Setiap 15 menit", "Pengingat 72 jam, resolusi 48 jam setelah pengingat, penutupan setelah 7 hari. Termasuk pemusnahan tiket dan lampiran lewat retensi.", true},
		{"ticket_retention_worker", "Retensi tiket tertutup", "support", "Dalam siklus helpdesk 15 menit", "Tiket billing/account tertutup minimal 30 hari, kategori lain 60 hari. Menghapus tiket, pesan, dan lampiran permanen.", true},
		{"item_retention_worker", "Retensi produk dan toko banned", "compliance", "Setiap 24 jam", "Peringatan hari 23, arsip hari 30, purge hari 90. Mencakup produk terhapus 72 jam dan katalog toko banned 90 hari dengan pengecualian sengketa sesuai fase.", true},
		{"cleaner_worker", "Pembersihan notifikasi dan sesi", "system", "Setiap jam", "Menghapus notifikasi kedaluwarsa, tanda baca dan sesi melewati batas retensi.", true},
		{"storage_sweeper", "Kuota dan file yatim", "storage", "Setiap jam", "Memindai penyimpanan lokal tiap toko. File produk tanpa referensi melewati masa tunggu 2 jam dapat dihapus permanen.", true},
		{"market_intel_worker", "Agregasi riset pasar", "analytics", "Setiap 24 jam sejak startup", "Agregasi hari UTC sebelumnya, benchmark harga, dan pembersihan data mentah berusia lebih dari 90 hari.", true},
		{"onboarding_engine", "Panduan toko baru", "lifecycle", "Saat notifikasi dibuka", "Menyemai tiga panduan bila toko belum memiliki notifikasi tertarget.", false},
		{"sse_hub", "Pengiriman notifikasi realtime", "streaming", "Saat event diterbitkan", "Mengirim ke koneksi yang sesuai dengan target pemberitahuan.", false},
		{"subscription_lifecycle", "Siklus langganan", "billing", "Setiap jam", "Invoice kedaluwarsa, pengingat H−3, tenggang 7 hari, penyesuaian paket dan kuota.", false},
		{"moderation_escalator", "Eskalasi moderasi toko", "compliance", "Dalam siklus dormansi", "Meninjau suspensi 30 hari dan pengecualian banding sebelum menetapkan sanksi.", false},
		{"moderation_media_cleanup", "Retensi media toko banned", "compliance", "Dalam siklus dormansi", "Membersihkan media toko dengan status banned minimal 90 hari.", false},
		{"activity_log_cleaner", "Retensi log aktivitas", "system", "Setiap 24 jam", "Retensi 90 hari untuk toko Free dan 365 hari secara global.", false},
		{"email_queue", "Antrean email", "system", "Saat antrean masuk atau setiap 5 detik", "Memproses email yang jatuh tempo serta menjadwalkan ulang pengiriman gagal.", false},
		{"search_ingest", "Pencatatan pencarian", "analytics", "50 event atau 500 ms", "Menyimpan data pencarian dan jumlah hasil nihil.", false},
		{"search_click", "Atribusi klik pencarian", "analytics", "Saat klik diterima", "Memperbarui jumlah klik dan CTR kata kunci.", false},
		{"store_ingest", "Penerimaan aktivitas toko", "analytics", "Saat event diterima", "Mengelompokkan kunjungan dan interaksi dalam memori.", false},
		{"store_flush", "Penyimpanan aktivitas toko", "analytics", "Setiap 5 detik", "Menyimpan batch aktivitas dan metrik audiens.", false},
		{"visitor_retention", "Retensi data pengunjung", "analytics", "Setiap jam", "Mengagregasi dan menghapus event mentah lewat 7 hari.", false},
		{"ad_flush", "Penyimpanan metrik iklan", "analytics", "Setiap 60 detik", "Menyimpan impresi dan klik per kampanye dan tanggal UTC.", false},
		{"trending", "Skor tren produk dan toko", "analytics", "Setiap 2 jam", "Menghitung skor berdasarkan kunjungan dan aksi selama tujuh hari.", false},
	}
	workers := make(map[string]*WorkerStatus, len(definitions))
	for _, d := range definitions {
		workers[d.id] = &WorkerStatus{Name: d.id, Title: d.title, Category: d.category, IntervalDesc: d.schedule, Conditions: d.conditions, Manual: d.manual, Status: "unknown"}
	}
	return workers
}

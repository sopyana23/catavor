package database

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// PolicyArticle represents an individual legal article within a structured policy document.
type PolicyArticle struct {
	Number     string   `json:"number"`
	Heading    string   `json:"heading"`
	Content    string   `json:"content"`
	Highlights []string `json:"highlights,omitempty"`
}

// PolicySectionData represents structured metadata and articles for a policy document.
type PolicySectionData struct {
	Category string          `json:"category"`
	Badge    string          `json:"badge"`
	IconKey  string          `json:"icon_key"`
	Summary  string          `json:"summary"`
	Articles []PolicyArticle `json:"articles"`
}

// PolicyDefinition defines the master default attributes for a platform legal document.
type PolicyDefinition struct {
	Type               string
	Title              string
	Version            string
	SummaryOfChanges   string
	ChangeType         string
	RequiresAcceptance bool
	Sections           PolicySectionData
}

// BuildMarkdownContent converts structured policy summary and articles into a rich Markdown string.
func BuildMarkdownContent(title string, summary string, articles []PolicyArticle) string {
	var sb strings.Builder
	if title != "" {
		sb.WriteString("# ")
		sb.WriteString(title)
		sb.WriteString("\n\n")
	}
	if summary != "" {
		sb.WriteString("> **Ringkasan Eksekutif:** ")
		sb.WriteString(summary)
		sb.WriteString("\n\n---\n\n")
	}

	for _, art := range articles {
		sb.WriteString("### ")
		if art.Number != "" {
			sb.WriteString(art.Number)
			sb.WriteString(": ")
		}
		sb.WriteString(art.Heading)
		sb.WriteString("\n\n")
		sb.WriteString(art.Content)
		sb.WriteString("\n\n")

		if len(art.Highlights) > 0 {
			sb.WriteString("**Ketentuan Pokok & Poin Kepatuhan:**\n")
			for _, h := range art.Highlights {
				sb.WriteString("- ")
				sb.WriteString(h)
				sb.WriteString("\n")
			}
			sb.WriteString("\n")
		}
	}

	return strings.TrimSpace(sb.String())
}

// GetDefaultPlatformPolicies returns the official 6 pillars of Catavor platform legal policies (26 comprehensive articles).
func GetDefaultPlatformPolicies() []PolicyDefinition {
	return []PolicyDefinition{
		// 1. SYARAT & KETENTUAN UMUM PLATFORM (TERMS)
		{
			Type:               "terms",
			Title:              "Syarat & Ketentuan Layanan Platform Catavor",
			Version:            "v2.0",
			SummaryOfChanges:   "Penyempurnaan klausul kedudukan PSE, aturan operasional lintas 7 tipe katalog, perlindungan hak cipta, dan batasan tanggung jawab hukum.",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Ketentuan Umum & Kedudukan Hukum",
				Badge:    "Dokumen Perjanjian Pengelola",
				IconKey:  "scale",
				Summary:  "Dokumen hukum resmi dari PT Catavor Media Digital yang mengatur kedudukan hukum platform sebagai Penyelenggara Sistem Elektronik (PSE), hak, batasan, serta kewajiban seluruh pengelola profil katalog merchant dan pengguna platform.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Kedudukan Hukum Platform & Ekosistem 7 Tipe Katalog",
						Content: "Platform Catavor bertindak semata-mata sebagai penyedia infrastruktur teknologi etalase katalog digital multi-tenant, manajemen inventaris, dan sarana komunikasi pemesanan mandiri. Catavor bukan merupakan penjual langsung, produsen, penyedia jasa, maupun perantara kepemilikan atas item yang dipublikasikan oleh masing-masing pengelola profil katalog.",
						Highlights: []string{
							"Catavor menyediakan infrastruktur profil katalog dan biolink resmi bisnis mandiri tanpa campur tangan kepemilikan barang.",
							"Platform mendukung 7 karakteristik katalog unik: Produk Fisik (physical), Kuliner (food), Produk Digital (digital), Jasa (service), Tanaman Hias (plant), Satwa & Peliharaan (fauna), dan Properti (property).",
							"Hubungan jual-beli, akad jasa, serta perikatan perdata terjalin langsung antara pengelola profil katalog dengan pembeli/konsumen akhir.",
							"Catavor tidak bertanggung jawab atas sengketa perdata yang timbul akibat wanprestasi atau ingkar janji antar-pihak di luar sistem Rekber resmi mitra platform.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Registrasi Akun, Kredensial, RBAC, & Tanggung Jawab Keamanan",
						Content: "Setiap pengelola profil katalog wajib mendaftarkan akun menggunakan data identitas yang valid dan nomor WhatsApp aktif. Pengelola bertanggung jawab penuh atas kerahasiaan kata sandi, token autentikasi, serta hak akses staf (Role-Based Access Control) yang diberikan kepada tim internalnya.",
						Highlights: []string{
							"Pengelola dilarang membagikan kredensial login utama kepada pihak luar tanpa otorisasi tertulis.",
							"Setiap tindakan yang dilakukan melalui akun terdaftar dianggap sah sebagai tindakan yang mewakili pemilik profil katalog.",
							"Pengelola wajib segera memberitahukan tim kepatuhan platform apabila mencurigai adanya peretasan atau akses tanpa hak atas akunnya.",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Kewajiban Integritas Data & Aturan Khusus 7 Tipe Katalog",
						Content: "Pengelola profil katalog wajib menjamin bahwa seluruh data item—termasuk nama, spesifikasi, harga satuan Rupiah, status stok, foto dokumentasi, dan ketentuan garansi—adalah akurat, sah, dan tidak menyesatkan (anti-misleading). Pengelola wajib mematuhi ketentuan spesifik pada masing-masing domain katalog.",
						Highlights: []string{
							"Kuliner (food): Wajib menjamin higienitas pangan, mencantumkan bahan pemicu alergi (allergen disclosure), masa kadaluwarsa, dan status kehalalan.",
							"Produk Digital (digital) & Jasa (service): Wajib menjamin keaslian lisensi perangkat lunak, hak kekayaan intelektual (HAKI), serta kejelasan ruang lingkup pengerjaan (Scope of Work).",
							"Tanaman (plant) & Fauna (fauna): Wajib memastikan komoditas non-dilindungi, kepemilikan dokumen karantina/BKSDA resmi, serta standar garansi hidup saat tiba (Live Arrival Guarantee / DOA).",
							"Properti (property): Wajib memastikan keabsahan sertifikat kepemilikan (SHM/SHGB/AJB) dan transparansi informasi perizinan mendirikan bangunan.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Hak Kekayaan Intelektual (HAKI) Konten Katalog & Lisensi Publikasi",
						Content: "Hak cipta atas seluruh materi visual, logo, foto dokumentasi, dan deskripsi produk yang diunggah tetap menjadi milik sah pengelola profil katalog atau pemilik lisensi aslinya. Dengan mengunggah konten ke Catavor, pengelola memberikan lisensi non-eksklusif dan bebas royalti kepada Catavor untuk menampilkan, mendistribusikan, dan mengoptimasi konten tersebut demi kelancaran operasional platform.",
						Highlights: []string{
							"Dilarang mengunggah materi visual atau merek dagang terdaftar milik pihak ketiga tanpa izin resmi atau hak keagenan yang sah.",
							"Catavor berhak menghapus atau menyembunyikan konten yang dilaporkan melanggar HAKI berdasarkan aduan yang disertai bukti kepemilikan sah.",
						},
					},
					{
						Number:  "Pasal 5",
						Heading: "Batasan Tanggung Jawab Platform & Force Majeure",
						Content: "Platform Catavor disediakan dengan prinsip 'sebagaimana adanya' (as-is). Dalam batas maksimum yang diizinkan oleh hukum Republik Indonesia, Catavor tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan bisnis, maupun gangguan layanan yang disebabkan oleh keadaan kahar (force majeure) seperti bencana alam, gangguan infrastruktur telekomunikasi nasional, atau kebijakan pemblokiran pihak berwenang.",
						Highlights: []string{
							"Catavor senantiasa mengupayakan ketersediaan infrastruktur layanan dengan target uptime 99.5% di luar pemeliharaan berkala terjadwal.",
							"Ganti rugi maksimal yang dapat dituntut oleh pengelola dibatasi sebesar biaya langganan paket aktif yang telah dibayarkan untuk bulan berjalan.",
						},
					},
				},
			},
		},

		// 2. KEBIJAKAN PENGGUNAAN & KOMODITAS TERLARANG (PROHIBITED / ACCEPTABLE USE)
		{
			Type:               "prohibited",
			Title:              "Kebijakan Penggunaan & Standar Komoditas Terlarang",
			Version:            "v2.0",
			SummaryOfChanges:   "Penyelarasan ketentuan konservasi satwa/tanaman, perlindungan pangan, larangan manipulasi sistem, dan penegakan whitelist domain aman eksternal.",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Kepatuhan Mutlak (Zero Tolerance)",
				Badge:    "Wajib Dipatuhi Pengelola",
				IconKey:  "shield-alert",
				Summary:  "Daftar komoditas terlarang, ketentuan konservasi flora/fauna, materi visual ilegal, serta larangan manipulasi teknis yang dilarang keras di seluruh ekosistem Catavor demi kepatuhan hukum dan keselamatan publik.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Komoditas Ilegal Mutlak & Zat Terlarang",
						Content: "Dilarang keras mempublikasikan, menawarkan, mengiklankan, atau memperdagangkan segala jenis barang atau zat yang dilarang oleh hukum pidana dan perundang-undangan khusus di Republik Indonesia.",
						Highlights: []string{
							"Narkotika, psikotropika, prekursor, zat adiktif, serta obat-obatan keras golongan G tanpa izin apotek atau resep dokter berwenang.",
							"Senjata api, replika airsoft gun tanpa izin klub resmi, bahan peledak, amunisi, senjata tajam penyerang, dan racun berbahaya.",
							"Dokumen resmi negara palsu (KTP, ijazah, sertifikat, paspor) atau layanan jasa pembuatan dokumen ilegal.",
							"Konten pornografi, eksploitasi seksual di bawah umur, perjudian online, taruhan, dan skema piramida/Ponzi yang merugikan masyarakat.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Perlindungan Konservasi Satwa (Fauna) & Tanaman (Plant)",
						Content: "Catavor menjunjung tinggi etika konservasi lingkungan hidup dan keanekaragaman hayati nusantara. Dilarang keras mempublikasikan, menjual, atau memfasilitasi transaksi atas satwa liar dan tumbuhan yang dilindungi oleh undang-undang nasional maupun konvensi internasional.",
						Highlights: []string{
							"Dilarang memperdagangkan seluruh satwa dan tumbuhan yang masuk dalam daftar dilindungi UU No. 5 Tahun 1990 dan Peraturan Menteri LHK No. P.106/2018 beserta perubahannya.",
							"Dilarang memperdagangkan flora/fauna yang masuk dalam lampiran CITES Appendiks I & II tanpa izin penangkaran F2 resmi dan kuota BKSDA sah.",
							"Fauna peliharaan non-lindung wajib memiliki keterangan asal-usul legal dan memenuhi standar kesejahteraan hewan (animal welfare).",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Standar Keamanan Pangan, Hak Cipta Perangkat Lunak, & Larangan Penipuan Properti",
						Content: "Setiap domain katalog memiliki batasan integritas yang wajib ditaati untuk mencegah bahaya keracunan pangan, pelanggaran lisensi perangkat lunak, maupun sengketa kepemilikan aset bernilai tinggi.",
						Highlights: []string{
							"Kuliner: Dilarang menjual makanan kadaluwarsa, pangan basi, obat tradisional tanpa nomor izin edar BPOM, atau pangan beracun.",
							"Produk Digital: Dilarang menjual software bajakan (cracked/nulled), akun curian/phishing, database privat tanpa hak, atau file bervirus.",
							"Properti: Dilarang memasang listing properti fiktif, sengketa tanah waris tanpa persetujuan ahli waris, atau menipu batas tanah/sertifikat.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Larangan Manipulasi Sistem, Scraping, & Penipuan Harga",
						Content: "Pengguna dilarang melakukan tindakan teknis maupun operasional yang merusak performa server, mengelabui algoritma katalog, atau memanipulasi interaksi pengguna lain.",
						Highlights: []string{
							"Dilarang melakukan scraping data otomatis, Denial of Service (DoS/DDoS), atau reverse engineering atas infrastruktur Catavor.",
							"Dilarang melakukan mark-up harga fiktif, pesanan palsu (fake order), ulasan palsu, atau spamming keyword pada judul produk.",
							"Dilarang mengeksploitasi celah keamanan (bug/exploit); penemuan celah wajib dilaporkan langsung melalui kanal Responsible Disclosure platform.",
						},
					},
					{
						Number:  "Pasal 5",
						Heading: "Kebijakan Tautan Eksternal & Master Safe Domains Whitelist",
						Content: "Pengelola hanya diizinkan menyematkan tautan keluar (eksternal link) menuju marketplace, media sosial, atau penyedia video terpercaya yang telah terdaftar dalam Master Safe Domains Whitelist resmi Catavor.",
						Highlights: []string{
							"Tautan menuju domain di luar whitelist akan memunculkan dialog konfirmasi perlindungan anti-phishing sebelum dibuka oleh pengguna.",
							"Dilarang keras menyematkan tautan penyingkat URL (URL shortener) yang menyembunyikan alamat tujuan asli (misal: bit.ly misterius).",
							"Penyematan link phishing, malware, atau situs penipuan akan berakibat pada pemblokiran permanen seketika (Tingkat 4 Blacklist).",
						},
					},
				},
			},
		},

		// 3. KEBIJAKAN PRIVASI & DATA (PRIVACY)
		{
			Type:               "privacy",
			Title:              "Kebijakan Privasi, Pelindungan Data (UU PDP) & Telemetri B2B",
			Version:            "v2.0",
			SummaryOfChanges:   "Penyesuaian standar UU Perlindungan Data Pribadi No. 27 Tahun 2022, transparansi riset telemetri agregat Zero-PII, K-Anonymity, dan hak penghapusan akun.",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Kepatuhan UU No. 27 Tahun 2022 (PDP)",
				Badge:    "Standar Perlindungan Privasi",
				IconKey:  "lock",
				Summary:  "Pernyataan transparansi resmi mengenai klasifikasi data yang dikumpulkan, mekanisme enkripsi, batas pemrosesan data agregat pasar Zero-PII, hak subjek data, serta jaminan kerahasiaan data pengguna.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Kepatuhan UU No. 27 Tahun 2022 & Klasifikasi Data yang Diproses",
						Content: "Catavor berkomitmen penuh melindungi hak privasi subjek data sesuai Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP). Platform mengumpulkan data yang diperlukan semata-mata untuk operasional akun dan penyajian katalog.",
						Highlights: []string{
							"Data Akun: Nama lengkap/nama bisnis, alamat email aktif, nomor WhatsApp bisnis, dan preferensi tampilan toko.",
							"Data Katalog: Nama item, deskripsi, harga resmi Rupiah, atribut spesifikasi, foto produk, serta tautan video resmi.",
							"Data Transaksi & Pesanan: Rekam jejak checkout mandiri yang diteruskan ke WhatsApp merchant atau mitra Rekber Syariah.",
							"Data Teknis & Keamanan: Alamat IP, user-agent browser, dan stempel waktu sesi untuk audit keamanan dan pencegahan fraud.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Isolasi Multi-Tenant, Enkripsi Kriptografis, & Cookie Sesi",
						Content: "Setiap data merchant disimpan secara terisolasi (Tenant Isolation) guna mencegah kebocoran data antar-toko. Catavor menerapkan standar enkripsi industri terkini untuk melindungi data sensitif pengguna.",
						Highlights: []string{
							"Kata sandi akun dienkripsi menggunakan algoritma hashing satu arah Argon2id / Bcrypt Cost 12 yang tahan serangan brute-force.",
							"Sesi login diamankan menggunakan JSON Web Token (JWT) dengan penandatanganan kriptografis aman dan atribut cookie HttpOnly/SameSite.",
							"Seluruh berkas media gambar yang diunggah diproses melalui kompresi cerdas dan dibersihkan dari metadata EXIF (termasuk koordinat GPS).",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Transparansi Telemetri Agregat, Zero-PII, K-Anonymity, & Riset Pasar B2B",
						Content: "Platform Catavor berhak mencatat, mengolah, dan menyajikan data statistik dan tren pasar agregat tanpa identitas pribadi (Zero-PII Anonymized Aggregate Data) untuk keperluan riset industri, peningkatan fitur, optimasi ekosistem UMKM, serta kemitraan analitik pasar B2B.",
						Highlights: []string{
							"Data yang diolah untuk riset pasar HANYA berupa tren agregat makro: kata kunci pencarian terpopuler, indeks kuartil harga (P25, P50, P75), demand gap, elastisitas harga, dan sebaran demografi perangkat/kota.",
							"Standar Zero-PII: Pemrosesan telemetri sama sekali TIDAK MEMUAT nama orang, nomor WhatsApp/telepon, alamat email, atau detail identitas privat konsumen.",
							"Penyamaran Sesi: Pelacakan klik/pencarian menggunakan HMAC-SHA256 dengan daily rotating salt acak sehingga riwayat penjelajahan tidak dapat dikaitkan dengan profil individu.",
							"Prinsip K-Anonymity: Laporan intelijen pasar B2B menerapkan ambang batas privasi (minimal 3 toko unik) sehingga data performa satu toko individual tidak pernah dapat diidentifikasi balik atau dijual secara mandiri.",
							"Jaminan Tegas: Data pribadi konsumen dan rahasia dagang internal toko TIDAK AKAN PERNAH DIJUAL kepada pihak ketiga mana pun.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Hak Subjek Data, Penghapusan Akun (Right to Erasure), & Retensi Bukti Hukum",
						Content: "Pengguna memiliki hak penuh atas data pribadinya, termasuk hak akses, koreksi data, serta permohonan penutupan akun dan penghapusan data (Right to Erasure) melalui menu Pengaturan Toko.",
						Highlights: []string{
							"Penghapusan toko akan memicu penghapusan fisik berkas foto/media secara permanen dari penyimpanan server cloud.",
							"Pengecualian Retensi Hukum: Rekam jejak persetujuan kebijakan (User Policy Agreements) dan riwayat transaksi masa lalu tetap diretensi secara terisolasi sebagai alat bukti elektronik yang sah sesuai ketentuan UU ITE.",
							"Permintaan penarikan persetujuan atau konfirmasi data privasi dapat dilayangkan ke Petugas Kepatuhan Data melalui email resmi support@catavor.com.",
						},
					},
				},
			},
		},

		// 4. STANDAR MODERASI & SANKSI KEPATUHAN (MODERATION)
		{
			Type:               "moderation",
			Title:              "Standar Penegakan Moderasi, Pembekuan Akun & Banding",
			Version:            "v2.0",
			SummaryOfChanges:   "Penegasan alur moderasi proaktif, sanksi berjenjang 4 tingkat, status kunci barang bukti, dan SLA banding gratis 2x24 jam kerja.",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Prosedur Disiplin Ekosistem",
				Badge:    "Transparansi & Akuntabilitas",
				IconKey:  "check-circle-2",
				Summary:  "Mekanisme pengawasan proaktif, investigasi laporan pelanggaran masyarakat, penerapan sanksi berjenjang 4 tingkat yang adil, serta prosedur banding kepatuhan resmi tanpa biaya.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Sistem Pengawasan Berkelanjutan & Kanal Laporan Masyarakat",
						Content: "Tim Kepatuhan Platform Catavor melakukan pemantauan proaktif secara berkala serta memproses laporan aduan masyarakat atas konten yang melanggar hukum atau pedoman komunitas.",
						Highlights: []string{
							"Pengawasan mencakup validitas harga, kesesuaian izin perdagangan satwa/tanaman, keaslian foto, dan nomor rekening penipuan.",
							"Masyarakat dapat melaporkan profil atau item mencurigakan melalui tombol Lapor Pelanggaran yang diverifikasi oleh tim kepatuhan.",
							"Laporan yang disertai bukti awal konkret (tangkapan layar, resi palsu, bukti transfer) diproses prioritas dalam kurun waktu 1x24 jam.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Matriks Sanksi 4 Tingkat Kepatuhan",
						Content: "Penindakan atas pelanggaran pedoman platform diterapkan secara proporsional dan transparan melalui matriks sanksi 4 tingkat:",
						Highlights: []string{
							"Tingkat 1 - Peringatan Tertulis (Warning Notice): Diberikan kepada merchant untuk merevisi kesalahan administratif, foto tidak jelas, atau kekeliruan kategori dalam batas waktu 2x24 jam.",
							"Tingkat 2 - Penguncian/Penonaktifan Item (Item Hidden/Locked): Item yang melanggar pedoman ditarik dari etalase publik dan statusnya diubah menjadi read-only demi mencegah transaksi berbahaya.",
							"Tingkat 3 - Pembekuan Sementara Katalog (Store Suspension): Seluruh etalase publik dinonaktifkan sementara apabila pengelola mengabaikan peringatan berulang atau terindikasi sengketa serius.",
							"Tingkat 4 - Pemutusan Akun Permanen (Permanent Blacklist): Diterapkan pada pelanggaran fatal seperti penipuan terbukti, perdagangan satwa dilindungi, narkotika, atau kejahatan siber.",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Status Penguncian Barang Bukti (Moderator Item Lock)",
						Content: "Untuk menjamin integritas penyelidikan hukum dan transparansi pembuktian, item katalog yang sedang berstatus Tingkat 2 (Item Locked) atau terlibat sengketa tidak dapat dihapus atau diubah oleh merchant.",
						Highlights: []string{
							"Penguncian barang bukti mencegah pelaku pelanggaran menghilangkan jejak digital sebelum proses investigasi tuntas.",
							"Status penguncian hanya dapat dicabut oleh Petugas Kepatuhan Platform setelah permohonan banding diterima atau sanggahan terbukti sah.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Prosedur Pengajuan Banding Kepatuhan Resmi & SLA Peninjauan",
						Content: "Pengelola profil katalog berhak mengajukan permohonan peninjauan kembali (Banding Kepatuhan) atas sanksi Tingkat 2 atau Tingkat 3 tanpa dipungut biaya apa pun.",
						Highlights: []string{
							"Permohonan banding diajukan resmi melalui menu Bantuan & Tiket (Helpdesk) dengan melampirkan bukti kepemilikan izin, sertifikat, atau klarifikasi kronologi.",
							"Tim Kepatuhan wajib memberikan tanggapan objektif dan keputusan tertulis dalam Service Level Agreement (SLA) maksimal 2x24 jam hari kerja.",
							"Keputusan atas banding tingkat kedua bersifat final dan mengikat secara administratif di lingkungan ekosistem Catavor.",
						},
					},
				},
			},
		},

		// 5. PEDOMAN TRANSAKSI & REKBER SYARIAH (TRANSACTIONS)
		{
			Type:               "transactions",
			Title:              "Pedoman Transaksi Aman, Kejujuran & Rekber Syariah",
			Version:            "v2.0",
			SummaryOfChanges:   "Pembaruan klausul transaksi langsung WhatsApp, integrasi Rekber Syariah 6 katalog, pengecualian Properti dari escrow, dan standar garansi Live Arrival (DOA).",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Integritas Pembayaran & Penyelesaian Sengketa",
				Badge:    "Prosedur Keamanan Keuangan",
				IconKey:  "check-circle-2",
				Summary:  "Tata kelola transaksi perniagaan mandiri, integrasi Rekber Syariah pihak ketiga, pengecualian transaksi properti, standar garansi pengiriman komoditas hidup, dan penanganan sengketa pembayaran.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Prinsip Transaksi Komunikasi WhatsApp Langsung & Transparansi Rupiah",
						Content: "Platform Catavor memfasilitasi komunikasi pesanan langsung ke nomor WhatsApp resmi pengelola toko. Seluruh harga yang tertera wajib menggunakan mata uang Rupiah (IDR) secara transparan dan jujur.",
						Highlights: []string{
							"Pengelola wajib menginformasikan rincian ongkos kirim, jasa ekspedisi terpercaya, serta estimasi waktu pengantaran barang secara transparan.",
							"Wajib memberikan nomor rekening bank resmi yang sesuai dengan identitas bisnis terdaftar guna mencegah penipuan transfer pihak ketiga.",
							"Wajib mengirimkan nomor resi pengiriman yang valid dan dapat dilacak kepada konsumen segera setelah paket diserahkan ke jasa kurir.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Integrasi Fasilitas Rekber Syariah Resmi Catavor",
						Content: "Untuk meningkatkan kepercayaan konsumen dan melindungi transaksi bernilai tinggi, Catavor mengintegrasikan layanan Rekening Bersama Syariah (rekbersyariah.com) sebagai mitra pihak ketiga resmi tepercaya.",
						Highlights: []string{
							"Fasilitas Rekber Syariah berlaku untuk 6 tipe katalog transaksional: Produk Fisik (physical), Kuliner (food), Produk Digital (digital), Jasa (service), Tanaman Hias (plant), dan Fauna (fauna).",
							"Akad Muamalah: Dana pembeli ditampung secara aman pada rekening escrow resmi Rekber Syariah berdasarkan prinsip syariah yang adil (Wakalah bil Ujrah / Ju'alah) dan baru dicairkan ke penjual setelah barang/layanan terkonfirmasi diterima dengan baik.",
							"Seluruh ketentuan biaya jasa rekber, pembuatan grup WhatsApp transaksi resmi, dan panduan validasi diatur oleh standar resmi mitra Rekber Syariah.",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Pengecualian Khusus Katalog Properti dari Rekber Otomatis",
						Content: "Katalog Properti (property) berfungsi semata-mata sebagai media listing informasi, pemasaran etalase, dan sarana penjadwalan survei lokasi fisik secara langsung antara peminat dan pemilik properti/agen resmi.",
						Highlights: []string{
							"Transaksi jual-beli, sewa-menyewa, atau peralihan hak atas tanah dan bangunan DIKECUALIKAN dari fasilitas Rekber Syariah otomatis.",
							"Segala bentuk perikatan pengalihan hak wajib dilakukan melalui prosedur hukum formal di hadapan Pejabat Pembuat Akta Tanah (PPAT) atau Notaris berwenang setelah melalui verifikasi fisik sertifikat asli (SHM/SHGB) dan lokasi objek.",
							"Dilarang keras mentransfer uang muka atau tanda jadi properti tanpa verifikasi fisik objek dan pemeriksaan legalitas kepemilikan yang sah.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Standar Pengiriman, Karantina Komoditas Hidup, & Klaim Dead on Arrival (DOA)",
						Content: "Khusus untuk transaksi Fauna (fauna) dan Tanaman (plant), pengelola profil katalog wajib menerapkan prosedur pengemasan khusus (packing berstandar keselamatan hidup) dan menyertakan dokumen karantina antar-pulau.",
						Highlights: []string{
							"Garansi Hidup Saat Tiba (Live Arrival Guarantee / DOA): Penjual wajib memberikan jaminan penggantian komoditas atau pengembalian dana apabila pesanan tiba dalam keadaan mati atau rusak parah.",
							"Syarat Klaim Sah DOA: Pembeli wajib merekam video unboxing utuh tanpa jeda (no cut, no edit) yang memperlihatkan kondisi paket utuh hingga spesimen dikeluarkan dalam kurun waktu maksimal 2 jam sejak paket diterima menurut log kurir.",
							"Klaim tanpa bukti video unboxing utuh tidak dapat diproses dalam penyelesaian sengketa Rekber Syariah.",
						},
					},
					{
						Number:  "Pasal 5",
						Heading: "Mediasi Sengketa Transaksi & Prosedur Pencairan/Pengembalian Dana",
						Content: "Apabila terjadi perselisihan atas kondisi barang, keterlambatan pengiriman, atau ketidaksesuaian spesifikasi pada transaksi yang menggunakan Rekber Syariah, tim mediasi akan memproses penyelesaian secara adil dan objektif.",
						Highlights: []string{
							"Dana escrow akan ditahan sementara sampai kedua belah pihak mencapai kesepakatan tertulis atau putusan mediasi ditetapkan.",
							"Jika terbukti penjual melakukan kelalaian atau pengiriman barang yang tidak sesuai, dana akan dikembalikan kepada pembeli (refund) sesuai prosedur escrow.",
						},
					},
				},
			},
		},

		// 6. KETENTUAN LANGGANAN MERCHANT, KUOTA & MASA AKTIF TOKO (SUBSCRIPTION)
		{
			Type:               "subscription",
			Title:              "Ketentuan Langganan Merchant, Kuota & Masa Aktif Toko",
			Version:            "v2.0",
			SummaryOfChanges:   "Pemberlakuan matriks kuota paket Free/Pro/Enterprise, aturan siklus penagihan, kebijakan non-refundable, proteksi downgrade, dan Store Dormancy Engine.",
			ChangeType:         "major",
			RequiresAcceptance: true,
			Sections: PolicySectionData{
				Category: "Model Layanan Bisnis & Keberlanjutan Sistem",
				Badge:    "Ketentuan Komersial Merchant",
				IconKey:  "file-text",
				Summary:  "Ketentuan paket berlangganan merchant, batas kapasitas kuota produk dan media penyimpanan, mekanisme pembayaran resmi, kebijakan non-refundable, serta prosedur Store Dormancy bagi toko tidak aktif.",
				Articles: []PolicyArticle{
					{
						Number:  "Pasal 1",
						Heading: "Tingkatan Paket Langganan, Batas Produk, & Kuota Penyimpanan Media",
						Content: "Catavor menyediakan pilihan tingkatan paket langganan bagi pengelola profil katalog merchant guna mengakomodasi skala bisnis yang beragam.",
						Highlights: []string{
							"Paket Free (Starter): Ditujukan untuk bisnis perintis dengan batas hingga 10 produk aktif dan kuota penyimpanan media 50 MB.",
							"Paket Pro (Bisnis Berkembang): Menyediakan kapasitas hingga 100 produk aktif, kuota penyimpanan 500 MB, fitur lencana Pro terverifikasi, analitik bisnis, dan prioritas dukungan.",
							"Paket Enterprise (Skala Besar): Menawarkan kuota produk tanpa batas, kapasitas penyimpanan media multi-gigabyte, integrasi domain kustom, serta akses telemetri pasar B2B lanjutan.",
						},
					},
					{
						Number:  "Pasal 2",
						Heading: "Siklus Penagihan, Metode Pembayaran Resmi, & Kebijakan Non-Refundable",
						Content: "Langganan paket berbayar diaktifkan melalui pembayaran berkala (bulanan atau tahunan) menggunakan saluran pembayaran resmi yang disediakan oleh platform.",
						Highlights: []string{
							"Metode pembayaran sah mencakup integrasi Payment Gateway Aulaa (QRIS instan, Virtual Account, E-Wallet) atau verifikasi transfer bank manual resmi platform.",
							"Kebijakan Non-Refundable: Biaya langganan paket yang telah dibayarkan dan telah aktif digunakan bersifat final dan tidak dapat dikembalikan (non-refundable) kecuali terjadi kesalahan penagihan ganda dari pihak platform.",
							"Pengelola bertanggung jawab menyelesaikan tagihan perpanjangan sebelum tanggal jatuh tempo guna menghindari penghentian otomatis fitur premium.",
						},
					},
					{
						Number:  "Pasal 3",
						Heading: "Berakhirnya Masa Langganan (Downgrade) & Perlindungan Over-Quota",
						Content: "Apabila masa langganan paket berbayar berakhir dan tidak diperpanjang, status akun profil katalog akan otomatis disesuaikan ke Paket Free.",
						Highlights: []string{
							"Perlindungan Data: Produk yang telah diunggah sebelumnya tidak akan dihapus seketika dari database, namun produk yang melebihi batas kuota Free akan disembunyikan sementara (draft/hidden) dari etalase publik.",
							"Pengelola tidak dapat menambah produk baru atau mengunggah media tambahan hingga kapasitas penyimpanan berada di bawah ambang batas paket aktif.",
							"Reaktivasi paket berbayar akan otomatis memulihkan kembali seluruh produk dan media yang tersembunyi.",
						},
					},
					{
						Number:  "Pasal 4",
						Heading: "Mesin Keaktifan Toko (Store Dormancy Engine) & Perpanjangan Aktivitas",
						Content: "Guna menjaga kualitas direktori publik dari toko-toko mati yang tidak lagi melayani pembeli, Catavor menerapkan sistem Store Dormancy Engine otomatis.",
						Highlights: []string{
							"Toko paket Free yang tidak memiliki aktivitas atau pembaruan katalog akan menerima Peringatan Awal pada hari ke-30 dan Peringatan Terakhir pada hari ke-38.",
							"Jika tetap tidak aktif sampai hari ke-45, katalog toko dinonaktifkan sementara (Dormant/Suspended) dan disembunyikan dari publik guna menjaga kualitas direktori.",
							"Pengelola memiliki masa tenggang 15 hari (hingga hari ke-60) untuk mengaktifkan kembali tokonya secara instan tanpa biaya melalui tautan reaktivasi email atau tombol Perpanjang Masa Aktif di dashboard admin sebelum data dan media dihapus permanen.",
						},
					},
				},
			},
		},
	}
}

// SeedPlatformPolicies hydrates or upgrades the 6 platform policies in the database.
func SeedPlatformPolicies(db *gorm.DB, overwriteExisting bool) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}

	defs := GetDefaultPlatformPolicies()
	now := time.Now().UTC()

	for _, def := range defs {
		sectionsJSON, err := json.Marshal(def.Sections)
		if err != nil {
			log.Error().Err(err).Str("type", def.Type).Msg("Failed to marshal policy sections JSON")
			continue
		}

		markdownContent := BuildMarkdownContent(def.Title, def.Sections.Summary, def.Sections.Articles)

		var existing models.PolicyVersion
		err = db.Where("type = ? AND is_active = true", def.Type).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Create new record
			newPolicy := models.PolicyVersion{
				Type:               def.Type,
				Title:              def.Title,
				Version:            def.Version,
				Content:            markdownContent,
				Sections:           datatypes.JSON(sectionsJSON),
				SummaryOfChanges:   def.SummaryOfChanges,
				ChangeType:         def.ChangeType,
				EffectiveDate:      now,
				IsActive:           true,
				RequiresAcceptance: def.RequiresAcceptance,
				CreatedBy:          1,
				CreatedAt:          now,
				UpdatedAt:          now,
			}
			if err := db.Create(&newPolicy).Error; err != nil {
				log.Error().Err(err).Str("type", def.Type).Msg("Failed to seed default policy version")
				return err
			}
			log.Info().Str("type", def.Type).Str("version", def.Version).Msg("Default policy seeded")
		} else if err == nil && overwriteExisting {
			// Append-only versioned reset: deactivate previous active version and insert fresh baseline row
			if err := db.Model(&models.PolicyVersion{}).Where("type = ? AND is_active = ?", def.Type, true).Update("is_active", false).Error; err != nil {
				return err
			}
			newPolicy := models.PolicyVersion{
				Type:               def.Type,
				Title:              def.Title,
				Version:            def.Version,
				Content:            markdownContent,
				Sections:           datatypes.JSON(sectionsJSON),
				SummaryOfChanges:   def.SummaryOfChanges,
				ChangeType:         def.ChangeType,
				EffectiveDate:      now,
				IsActive:           true,
				RequiresAcceptance: def.RequiresAcceptance,
				CreatedBy:          1,
				CreatedAt:          now,
				UpdatedAt:          now,
			}
			if err := db.Create(&newPolicy).Error; err != nil {
				log.Error().Err(err).Str("type", def.Type).Msg("Failed to create reset policy version")
				return err
			}
		} else if err == nil && (existing.Version == "v1.0" || existing.Version == "v1.5.0") {
			// Boot-time upgrade only for legacy v1.0/v1.5.0 defaults (never overwrite custom admin versions!)
			existing.Title = def.Title
			existing.Version = def.Version
			existing.Content = markdownContent
			existing.Sections = datatypes.JSON(sectionsJSON)
			existing.SummaryOfChanges = def.SummaryOfChanges
			existing.ChangeType = def.ChangeType
			existing.RequiresAcceptance = def.RequiresAcceptance
			existing.UpdatedAt = now
			if err := db.Save(&existing).Error; err != nil {
				log.Error().Err(err).Str("type", def.Type).Msg("Failed to upgrade legacy policy version")
				return err
			}
			log.Info().Str("type", def.Type).Str("version", def.Version).Msg("Legacy default policy upgraded to structured format")
		}
	}

	return nil
}


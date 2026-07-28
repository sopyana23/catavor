<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\PolicyVersion;
use App\Models\UserPolicyAgreement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettingController extends Controller
{
    public function index()
    {
        $settings = Setting::all()->pluck('value', 'key')->toArray();

        $defaults = [
            'master_classes' => json_encode(['Ikan Hias', 'Mamalia', 'Mamalia Kecil', 'Reptil']),
            'master_habitats' => json_encode(['Air Tawar', 'Air Laut', 'Darat']),
            'master_statuses' => json_encode(['Tersedia (For Sale)', 'Habis Terjual (Sold Out)', 'Terbatas (Limited)']),
            'master_shipping_coverages' => json_encode(['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (No Shipping)']),
            'about_title' => 'Tentang Catavor',
            'about_slogan' => 'Platform Katalog Digital & Biolink Bisnis Modern',
            'about_description' => 'Catavor adalah platform katalog digital serba guna yang dirancang khusus untuk membantu para UMKM dan pemilik bisnis memajang produk, mengelola pesanan WhatsApp, serta memperluas jangkauan pasar secara profesional.',
            'about_location' => 'Bandung, Jawa Barat, Indonesia',
            'about_hours' => '08:00 - 21:00 WIB (Setiap Hari)',
            'about_disclaimer' => 'Catavor berkomitmen penuh terhadap kepatuhan hukum dan perlindungan privasi konsumen. Setiap transaksi dan konten katalog tunduk pada Syarat & Ketentuan serta Kebijakan Privasi resmi.',
            'app_theme' => 'dark',
            'store_theme' => 'emerald',
            'about_cards' => json_encode([
                ['title' => 'Garansi Keamanan Data', 'content' => 'Data usaha dan privasi pengguna dilindungi dengan enkripsi standar industri.', 'icon' => 'shield'],
                ['title' => 'Kemudahan Transaksi', 'content' => 'Mendukung pemesanan langsung WhatsApp Direct dan Rekber Terpercaya.', 'icon' => 'lock'],
                ['title' => 'Dukungan 24/7', 'content' => 'Tim teknis kami siap membantu optimalisasi katalog dan biolink bisnis Anda.', 'icon' => 'message']
            ]),
            'social_links' => json_encode([
                ['platform' => 'Instagram', 'url' => 'https://instagram.com/catavor'],
                ['platform' => 'Facebook', 'url' => 'https://facebook.com/catavor']
            ]),
            'payment_bank_name' => 'Bank Central Asia (BCA)',
            'payment_bank_account' => '8830-1928-3920',
            'payment_bank_holder' => 'PT Catavor Media Digital',
            'payment_qris_image' => '/img/qris_demo.svg',
            'master_coupons' => json_encode([
                ['code' => 'CATAVOR100', 'type' => 'free', 'discount' => 30000, 'label' => 'Gratis 100% Plan Pro (1 Bulan)'],
                ['code' => 'GRATISPRO', 'type' => 'free', 'discount' => 30000, 'label' => 'Gratis Uji Coba Plan Pro'],
                ['code' => 'DISKON10K', 'type' => 'discount', 'discount' => 10000, 'label' => 'Potongan Harga Rp 10.000']
            ])
        ];

        foreach ($defaults as $key => $defaultValue) {
            if (!isset($settings[$key])) {
                Setting::updateOrCreate(['key' => $key], ['value' => $defaultValue]);
                $settings[$key] = $defaultValue;
            }
        }

        return response()->json([
            'success' => true,
            'data' => $settings
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'settings' => 'required|array',
            'settings.whatsapp_number' => 'nullable|string|max:50',
            'settings.store_slogan' => 'nullable|string|max:255',
            'settings.promo_banner' => 'nullable|string|max:1000',
            'settings.store_theme' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $inputSettings = $request->input('settings');

        foreach ($inputSettings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        $updatedSettings = Setting::all()->pluck('value', 'key');

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan berhasil diperbarui!',
            'data' => $updatedSettings
        ]);
    }

    public function getPolicies()
    {
        $types = ['terms', 'privacy', 'acceptable_use'];
        $policies = [];

        foreach ($types as $type) {
            $latest = PolicyVersion::where('policy_type', $type)->orderBy('id', 'desc')->first();
            if (!$latest) {
                $latest = $this->createDefaultPolicyVersion($type);
            }
            $policies[$type] = [
                'type' => $type,
                'version' => $latest->version,
                'title' => $latest->title,
                'content' => $latest->content,
                'published_at' => $latest->published_at ? $latest->published_at->toIso8601String() : null
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $policies
        ]);
    }

    public function updatePolicy(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'policy_type' => 'required|in:terms,privacy,acceptable_use',
            'version' => 'required|string|max:20',
            'title' => 'required|string|max:255',
            'content' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $policy = PolicyVersion::create([
            'policy_type' => $request->policy_type,
            'version' => $request->version,
            'title' => $request->title,
            'content' => $request->content,
            'published_at' => now()
        ]);

        Setting::updateOrCreate(
            ['key' => $request->policy_type . '_policy_version'],
            ['value' => $request->version]
        );
        Setting::updateOrCreate(
            ['key' => $request->policy_type . '_policy_content'],
            ['value' => $request->content]
        );

        return response()->json([
            'success' => true,
            'message' => 'Kebijakan ' . $request->title . ' versi ' . $request->version . ' berhasil dipublikasikan!',
            'data' => $policy
        ]);
    }

    public function getPolicyAuditLogs()
    {
        $logs = UserPolicyAgreement::orderBy('id', 'desc')->take(50)->get();
        return response()->json([
            'success' => true,
            'data' => $logs
        ]);
    }

    private function createDefaultPolicyVersion($type)
    {
        $defaults = [
            'terms' => [
                'title' => 'Syarat & Ketentuan Layanan',
                'version' => 'v1.0.0',
                'content' => "### 1. Ketentuan Umum Layanan Catavor\nCatavor adalah platform penyedia katalog digital dan biolink bisnis online bagi pemilik usaha (Merchant). Dengan mengakses atau menggunakan platform ini, pengguna menyatakan menyetujui seluruh ketentuan yang berlaku.\n\n### 2. Hak & Kewajiban Merchant\n- Merchant bertanggung jawab penuh atas kebenaran informasi produk, stok, harga, dan foto yang diunggah ke katalog.\n- Dilarang menjual barang atau jasa ilegal yang melanggar hukum Republik Indonesia.\n\n### 3. Batasan Tanggung Jawab Transaksi\nCatavor menyediakan sarana katalog digital & alat komunikasi pesanan (WhatsApp Direct/Rekber). Catavor tidak bertanggung jawab atas sengketa independen antara pembeli dan penjual di luar sistem resmi.\n\n### 4. Hak Cipta & Kekayaan Intelektual\nSeluruh desain platform, kode, dan merek dagang Catavor adalah milik PT Catavor Media Digital."
            ],
            'privacy' => [
                'title' => 'Kebijakan Privasi & Perlindungan Data',
                'version' => 'v1.0.0',
                'content' => "### 1. Pengumpulan & Penggunaan Data\nKami mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar, seperti nama toko, alamat email, nomor WhatsApp bisnis, serta alamat usaha.\n\n### 2. Keamanan & Enkripsi Data\nSeluruh data pengguna disimpan pada infrastruktur server terenkripsi. Kami menerapkan standar perlindungan sesuai Undang-Undang Perlindungan Data Pribadi (UU PDP).\n\n### 3. Komitmen Kerahasiaan\nCatavor TIDAK AKAN PERNAH menjual, menyewakan, atau membagikan data pribadi atau data pelanggan toko Anda kepada pihak ketiga tanpa persetujuan eksplisit dari Anda.\n\n### 4. Hak Pengguna Atas Data\nAnda berhak memperbarui, mengunduh, atau mengajukan penghapusan data toko Anda kapan saja melalui panel admin atau pusat bantuan."
            ],
            'acceptable_use' => [
                'title' => 'Ketentuan Penggunaan & Komunitas',
                'version' => 'v1.0.0',
                'content' => "### 1. Larangan Konten & Barang Ilegal\nPengguna dilarang keras menampilkan, menawarkan, atau menjual:\n- Narkotika, obat-obatan terlarang, atau bahan berbahaya.\n- Senjata api, senjata tajam ilegal, atau bahan peledak.\n- Satwa liar dilindungi atau flora liar terlarang.\n- Produk tiruan/pembajakan ciptaan tanpa izin sah.\n\n### 2. Penangguhan & Pemblokiran Akun\nPelanggaran terhadap ketentuan penggunaan ini akan mengakibatkan penangguhan atau pemblokiran permanen terhadap katalog toko tanpa pemberitahuan sebelumnya."
            ]
        ];

        $def = $defaults[$type] ?? $defaults['terms'];

        return PolicyVersion::create([
            'policy_type' => $type,
            'version' => $def['version'],
            'title' => $def['title'],
            'content' => $def['content'],
            'published_at' => now()
        ]);
    }
}

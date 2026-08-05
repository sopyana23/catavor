<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Store;
use App\Models\Fauna;
use App\Models\Setting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seed default admin user
        $user = User::create([
            'name' => 'Administrator',
            'email' => 'admin@catavor.com',
            'password' => Hash::make('password123'),
            'is_password_changed' => true
        ]);

        // 2. Create matching default Store profile for admin (Catavor Pro Plan)
        $store = Store::create([
            'user_id' => $user->id,
            'slug' => 'catavor',
            'plan' => 'pro',
            'store_title' => 'Catavor',
            'store_slogan' => 'Solusi Katalog Digital & Portofolio Bisnis Terpercaya',
            'registration_timezone' => 'Asia/Jakarta',
            'whatsapp_number' => '',
            'enable_wa_direct' => true,
            'enable_wa_rekber' => true,
            'about_title' => 'Tentang Catavor',
            'about_slogan' => 'Komitmen Layanan Profesional & Kualitas Terbaik',
            'about_description' => 'Selamat datang di Catavor. Kami adalah platform penyedia produk dan layanan berkualitas tinggi yang berkomitmen memberikan pengalaman terbaik bagi pelanggan. Seluruh produk kami dikelola dengan standar profesional dan jaminan kepuasan.',
            'about_location' => '',
            'about_hours' => '08:00 - 21:00 WIB (Senin - Minggu)',
            'about_disclaimer' => 'Komitmen Jaminan Layanan: Seluruh transaksi dan informasi produk dikelola secara profesional dengan mengutamakan kepuasan pelanggan dan kejelasan data.',
            'about_cards' => [
                ['title' => 'Garansi Kualitas', 'content' => 'Setiap produk dan layanan melewati standar kontrol kualitas profesional sebelum disampaikan kepada Anda.', 'icon' => 'shield'],
                ['title' => 'Layanan Responsif', 'content' => 'Tim kami siap membantu kebutuhan konsultasi dan pertanyaan Anda secara cepat dan ramah.', 'icon' => 'message'],
                ['title' => 'Keamanan Transaksi', 'content' => 'Menjamin keamanan komunikasi dan kemudahan pesanan melalui saluran resmi terverifikasi.', 'icon' => 'lock']
            ],
            'social_links' => [],
            'official_website' => '',
            'master_classes' => ['Elektronik', 'Pakaian & Aksesoris', 'Satwa Hias', 'Pakan & Perlengkapan', 'Produk General'],
            'master_habitats' => ['Baru (New)', 'Bekas (Used)', 'General'],
            'master_statuses' => ['Tersedia (Ready Stock)', 'Habis Terjual (Out of Stock)', 'Pre-Order'],
            'master_shipping_coverages' => ['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (Pickup)']
        ]);

        // 3. Call Fauna and Article Seeders
        $this->call(FaunaSeeder::class);
        $this->call(ArticleSeeder::class);

        // 4. Scoped all seeded faunas to the default admin store
        Fauna::whereNull('store_id')->update(['store_id' => $store->id]);

        // 5. Seed legacy fallback setting for safety
        Setting::create([
            'key' => 'whatsapp_number',
            'value' => '628123456789'
        ]);

        Setting::create([
            'key' => 'store_slogan',
            'value' => 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis.'
        ]);
    }
}

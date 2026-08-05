<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Store;
use App\Models\PolicyVersion;
use App\Models\UserPolicyAgreement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => $request->filled('google_id') ? 'nullable|string|min:6' : 'required|string|min:6',
            'store_name' => 'required|string|max:255',
            'store_slug' => [
                'required',
                'string',
                'max:100',
                'regex:/^[a-zA-Z0-9\-]+$/',
                'unique:stores,slug'
            ]
        ], [
            'store_slug.regex' => 'Username toko hanya boleh berisi huruf, angka, dan tanda hubung (-).',
            'store_slug.unique' => 'Link toko sudah digunakan oleh pengguna lain.'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Create User (Generate random secure hash if registering via Google SSO without manual password)
        $userPassword = $request->filled('password') ? $request->password : Str::random(32);
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($userPassword),
            'google_id' => $request->input('google_id'),
            'avatar' => $request->input('avatar'),
            'is_password_changed' => true
        ]);

        $requestedPlan = $request->input('plan', 'free');
        $paymentStatus = $request->input('payment_status', 'none');
        $paymentProofUrl = $request->input('payment_proof_url');

        // If user submitted payment proof for Pro plan, set initial active plan to 'free' until approved by admin
        $activePlan = ($requestedPlan === 'pro' && $paymentStatus === 'pending_approval') ? 'free' : $requestedPlan;
        if (!in_array($activePlan, ['free', 'pro'])) {
            $activePlan = 'free';
        }

        $clientTimezone = $request->input('timezone', 'Asia/Jakarta');
        $timeSuffix = $this->mapTimezoneToSuffix($clientTimezone);

        // Create Store with default configuration parameters
        $store = Store::create([
            'user_id' => $user->id,
            'slug' => Str::slug($request->store_slug),
            'plan' => $activePlan,
            'payment_status' => $paymentStatus,
            'payment_proof_url' => $paymentProofUrl,
            'store_title' => $request->store_name,
            'store_slogan' => 'Solusi Katalog Digital & Portofolio Bisnis Terpercaya',
            'registration_timezone' => $clientTimezone,
            'whatsapp_number' => '', // Sensitive field empty by default
            'enable_wa_direct' => true,
            'enable_wa_rekber' => true,
            'about_title' => 'Tentang ' . $request->store_name,
            'about_slogan' => 'Katalog Resmi Produk & Informasi Bisnis',
            'about_description' => 'Selamat datang di ' . $request->store_name . '. Kami adalah platform penyedia produk dan layanan berkualitas tinggi yang berkomitmen memberikan pengalaman terbaik bagi pelanggan. Seluruh produk kami dikelola dengan standar profesional dan jaminan kepuasan.',
            'about_location' => '', // Sensitive field empty by default
            'about_hours' => '', // Empty by default until set by user
            'about_disclaimer' => 'Komitmen Jaminan Layanan: Seluruh transaksi dan informasi produk dikelola secara profesional dengan mengutamakan kepuasan pelanggan dan kejelasan data.',
            'about_cards' => [
                ['title' => 'Garansi Kualitas', 'content' => 'Setiap produk dan layanan melewati standar kontrol kualitas profesional sebelum disampaikan kepada Anda.', 'icon' => 'shield'],
                ['title' => 'Layanan Responsif', 'content' => 'Tim kami siap membantu kebutuhan konsultasi dan pertanyaan Anda secara cepat dan ramah.', 'icon' => 'message'],
                ['title' => 'Keamanan Transaksi', 'content' => 'Menjamin keamanan komunikasi dan kemudahan pesanan melalui saluran resmi terverifikasi.', 'icon' => 'lock']
            ],
            'social_links' => [], // Sensitive field empty by default
            'official_website' => '', // Sensitive field empty by default
            'master_classes' => ['Elektronik', 'Pakaian & Aksesoris', 'Satwa Hias', 'Pakan & Perlengkapan', 'Produk General'],
            'master_habitats' => ['Baru (New)', 'Bekas (Used)', 'General'],
            'master_statuses' => ['Tersedia (Ready Stock)', 'Habis Terjual (Out of Stock)', 'Pre-Order'],
            'master_shipping_coverages' => ['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (Pickup)']
        ]);

        // Log immutable Policy Agreement Audit Trail for Terms & Privacy
        foreach (['terms', 'privacy'] as $pType) {
            $latestPolicy = PolicyVersion::where('policy_type', $pType)->orderBy('id', 'desc')->first();
            $versionStr = $latestPolicy ? $latestPolicy->version : 'v1.0.0';
            $snapshotContent = $latestPolicy ? $latestPolicy->content : 'Default Catavor Legal Policy v1.0.0';

            UserPolicyAgreement::create([
                'user_id' => $user->id,
                'store_slug' => $store->slug,
                'policy_type' => $pType,
                'version' => $versionStr,
                'content_snapshot' => $snapshotContent,
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? 'Web Browser', 0, 250),
                'agreed_at' => now()
            ]);
        }

        $token = $user->createToken('admin-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registrasi berhasil!',
            'token' => $token,
            'is_password_changed' => true,
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'store_slug' => $store->slug,
                'store_title' => $store->store_title,
                'store_plan' => $store->plan,
                'payment_status' => $store->payment_status
            ]
        ]);
    }

    /**
     * Handle Google SSO (Single Sign-On) for Registration and Login
     */
    public function googleAuth(Request $request)
    {
        $email = $request->input('email');
        $name = $request->input('name');
        $googleId = $request->input('google_id');
        $avatar = $request->input('avatar');

        // If JWT token/credential is passed from Google GSI Client, decode base64 JWT payload safely
        if ($request->has('credential')) {
            $parts = explode('.', $request->input('credential'));
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
                if (is_array($payload)) {
                    $email = $payload['email'] ?? $email;
                    $name = $payload['name'] ?? $name;
                    $googleId = $payload['sub'] ?? $googleId;
                    $avatar = $payload['picture'] ?? $avatar;
                }
            }
        }

        if (empty($email)) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mendapatkan email dari otentikasi Google.'
            ], 422);
        }

        // Check if user already exists in database
        $user = User::where('email', $email)->orWhere(function($query) use ($googleId) {
            if (!empty($googleId)) {
                $query->where('google_id', $googleId);
            }
        })->first();

        // CASE A: USER ALREADY EXISTS (LOGIN FLOW)
        if ($user) {
            if (empty($user->google_id) && !empty($googleId)) {
                $user->google_id = $googleId;
            }
            if (empty($user->avatar) && !empty($avatar)) {
                $user->avatar = $avatar;
            }
            $user->save();

            $store = Store::where('user_id', $user->id)->first();
            $token = $user->createToken('admin-token')->plainTextToken;

            return response()->json([
                'success' => true,
                'is_new_user' => false,
                'message' => 'Login Google berhasil!',
                'token' => $token,
                'is_password_changed' => true,
                'user' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar,
                    'store_slug' => $store ? $store->slug : null,
                    'store_title' => $store ? $store->store_title : null,
                    'store_plan' => $store ? $store->plan : 'free'
                ]
            ]);
        }

        // CASE B: NEW USER (REGISTRATION FLOW)
        $storeName = $request->input('store_name');
        $storeSlug = $request->input('store_slug');
        $plan = $request->input('plan', 'free');

        if (empty($storeName) || empty($storeSlug)) {
            return response()->json([
                'success' => true,
                'is_new_user' => true,
                'requires_store_info' => true,
                'message' => 'Otentikasi Google berhasil! Silakan tentukan Nama Toko dan Link Username Anda.',
                'google_data' => [
                    'name' => $name,
                    'email' => $email,
                    'google_id' => $googleId,
                    'avatar' => $avatar
                ]
            ]);
        }

        // Validate slug uniqueness
        $existingStore = Store::where('slug', Str::slug($storeSlug))->first();
        if ($existingStore) {
            return response()->json([
                'success' => false,
                'message' => 'Link username toko "' . $storeSlug . '" sudah digunakan. Silakan pilih username lain.'
            ], 422);
        }

        // Create new User
        $newUser = User::create([
            'name' => $name ?: 'Pemilik Toko',
            'email' => $email,
            'password' => Hash::make(Str::random(16)),
            'google_id' => $googleId,
            'avatar' => $avatar,
            'is_password_changed' => true
        ]);

        if (!in_array($plan, ['free', 'pro'])) {
            $plan = 'free';
        }

        $clientTimezone = $request->input('timezone', 'Asia/Jakarta');
        $timeSuffix = $this->mapTimezoneToSuffix($clientTimezone);

        // Create new Store
        $newStore = Store::create([
            'user_id' => $newUser->id,
            'slug' => Str::slug($storeSlug),
            'plan' => $plan,
            'store_title' => $storeName,
            'store_slogan' => 'Solusi Katalog Digital & Portofolio Bisnis Terpercaya',
            'registration_timezone' => $clientTimezone,
            'whatsapp_number' => '', // Sensitive field empty by default
            'enable_wa_direct' => true,
            'enable_wa_rekber' => true,
            'about_title' => 'Tentang ' . $storeName,
            'about_slogan' => 'Katalog Resmi Produk & Informasi Bisnis',
            'about_description' => 'Selamat datang di ' . $storeName . '. Kami adalah platform penyedia produk dan layanan berkualitas tinggi yang berkomitmen memberikan pengalaman terbaik bagi pelanggan. Seluruh produk kami dikelola dengan standar profesional dan jaminan kepuasan.',
            'about_location' => '', // Sensitive field empty by default
            'about_hours' => '', // Empty by default until set by user
            'about_disclaimer' => 'Komitmen Jaminan Layanan: Seluruh transaksi dan informasi produk dikelola secara profesional dengan mengutamakan kepuasan pelanggan dan kejelasan data.',
            'about_cards' => [
                ['title' => 'Garansi Kualitas', 'content' => 'Setiap produk dan layanan melewati standar kontrol kualitas profesional sebelum disampaikan kepada Anda.', 'icon' => 'shield'],
                ['title' => 'Layanan Responsif', 'content' => 'Tim kami siap membantu kebutuhan konsultasi dan pertanyaan Anda secara cepat dan ramah.', 'icon' => 'message'],
                ['title' => 'Keamanan Transaksi', 'content' => 'Menjamin keamanan komunikasi dan kemudahan pesanan melalui saluran resmi terverifikasi.', 'icon' => 'lock']
            ],
            'social_links' => [], // Sensitive field empty by default
            'official_website' => '', // Sensitive field empty by default
            'master_classes' => ['Elektronik', 'Pakaian & Aksesoris', 'Satwa Hias', 'Pakan & Perlengkapan', 'Produk General'],
            'master_habitats' => ['Baru (New)', 'Bekas (Used)', 'General'],
            'master_statuses' => ['Tersedia (Ready Stock)', 'Habis Terjual (Out of Stock)', 'Pre-Order'],
            'master_shipping_coverages' => ['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (Pickup)']
        ]);

        $token = $newUser->createToken('admin-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'is_new_user' => true,
            'message' => 'Pendaftaran Google berhasil!',
            'token' => $token,
            'is_password_changed' => true,
            'user' => [
                'name' => $newUser->name,
                'email' => $newUser->email,
                'avatar' => $newUser->avatar,
                'store_slug' => $newStore->slug,
                'store_title' => $newStore->store_title,
                'store_plan' => $newStore->plan
            ]
        ]);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau password salah.'
            ], 401);
        }

        $token = $user->createToken('admin-token')->plainTextToken;
        $store = $user->store;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil!',
            'token' => $token,
            'is_password_changed' => (bool)$user->is_password_changed,
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'store_slug' => $store ? $store->slug : null,
                'store_title' => $store ? $store->store_title : null,
                'store_plan' => $store ? ($store->plan ?? 'free') : 'free'
            ]
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil!'
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user->name = $request->name;
        $user->email = $request->email;

        if (!empty($request->password)) {
            $user->password = Hash::make($request->password);
            $user->is_password_changed = true;
        }

        $user->save();
        $store = $user->store;

        return response()->json([
            'success' => true,
            'message' => 'Profil admin berhasil diperbarui!',
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'store_slug' => $store ? $store->slug : null,
                'store_title' => $store ? $store->store_title : null
            ]
        ]);
    }

    /**
     * Map client timezone to Indonesian Time Standard Suffix (WIB, WITA, WIT).
     */
    private function mapTimezoneToSuffix(?string $timezone): string
    {
        if (!$timezone) {
            return 'WIB';
        }

        $tzUpper = strtoupper($timezone);

        if (str_contains($tzUpper, 'MAKASSAR') || str_contains($tzUpper, 'UJUNG_PANDANG') || str_contains($tzUpper, 'DENPASAR') || str_contains($tzUpper, 'MATARAM') || str_contains($tzUpper, 'KUPANG') || str_contains($tzUpper, 'WITA')) {
            return 'WITA';
        }

        if (str_contains($tzUpper, 'JAYAPURA') || str_contains($tzUpper, 'AMBON') || str_contains($tzUpper, 'WIT')) {
            return 'WIT';
        }

        return 'WIB';
    }
}

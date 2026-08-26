<?php

namespace App\Http\Controllers;

use App\Models\Store;
use App\Models\Fauna;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class StoreController extends Controller
{
    /**
     * Get recent featured stores
     */
    public function featuredStores()
    {
        $stores = Store::latest()->limit(8)->get(['store_title', 'slug', 'store_slogan', 'store_logo_url']);
        return response()->json([
            'success' => true,
            'data' => $stores
        ]);
    }

    /**
     * Get store settings/profile by slug
     */
    public function show($slug)
    {
        $store = Store::where('slug', $slug)->first();

        if (!$store) {
            return response()->json([
                'success' => false,
                'message' => 'Katalog / Store tidak ditemukan.'
            ], 404);
        }

        $store->makeHidden(['payment_proof_url']);

        return response()->json([
            'success' => true,
            'data' => $store
        ]);
    }

    /**
     * Check if a store slug is available or taken
     */
    public function checkSlug($slug)
    {
        $cleanSlug = strtolower(trim($slug));
        $reserved = ['api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'admin', 'u'];
        
        if (in_array($cleanSlug, $reserved) || strlen($cleanSlug) < 3) {
            return response()->json([
                'success' => false,
                'available' => false,
                'message' => 'Username ini tidak tersedia atau dicadangkan oleh sistem.'
            ], 200);
        }

        $exists = Store::where('slug', $cleanSlug)->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'available' => false,
                'message' => 'Link username "' . $cleanSlug . '" sudah digunakan oleh toko lain.'
            ], 200);
        }

        return response()->json([
            'success' => true,
            'available' => true,
            'message' => 'Link username "' . $cleanSlug . '" tersedia!'
        ], 200);
    }

    /**
     * Get fauna items scoped to a store slug
     */
    public function indexFauna(Request $request, $slug)
    {
        $store = Store::where('slug', $slug)->first();

        if (!$store) {
            return response()->json([
                'success' => false,
                'message' => 'Katalog / Store tidak ditemukan.'
            ], 404);
        }

        $query = Fauna::where('store_id', $store->id)->withCount('sightings');

        // Filter by Search (Name or Scientific Name)
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('scientific_name', 'like', "%{$search}%");
            });
        }

        // Filter by Class
        if ($request->has('class') && !empty($request->class) && $request->class !== 'all') {
            $query->where('class', $request->class);
        }

        // Filter by Habitat
        if ($request->has('habitat') && !empty($request->habitat) && $request->habitat !== 'all') {
            $query->where('habitat', 'like', "%{$request->habitat}%");
        }

        $faunas = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $faunas
        ]);
    }

    /**
     * Update store profile details (general, about, social, settings)
     */
    public function update(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json([
                'success' => false,
                'message' => 'Katalog / Store tidak ditemukan.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'store_title' => 'sometimes|required|string|max:255',
            'store_slogan' => 'nullable|string|max:255',
            'store_logo_url' => 'nullable|string',
            'store_theme' => 'nullable|string|max:50',
            'whatsapp_number' => 'nullable|string',
            'enable_wa_direct' => 'nullable|boolean',
            'enable_wa_rekber' => 'nullable|boolean',
            'plan' => 'nullable|string|in:free,pro',
            'promo_banner' => 'nullable|string',
            
            // About Us details
            'about_title' => 'nullable|string|max:255',
            'about_slogan' => 'nullable|string|max:255',
            'about_description' => 'nullable|string',
            'about_location' => 'nullable|string|max:255',
            'about_hours' => 'nullable|string',
            'show_hours' => 'nullable|boolean',
            'about_disclaimer' => 'nullable|string',
            'about_cards' => 'nullable|array',
            
            // Social Links & Master options
            'social_links' => 'nullable|array',
            'official_website' => 'nullable|string|max:500',
            'master_classes' => 'nullable|array',
            'master_habitats' => 'nullable|array',
            'master_statuses' => 'nullable|array',
            'master_shipping_coverages' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $store->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan toko berhasil diperbarui!',
            'data' => $store
        ]);
    }

    /**
     * Upgrade / Toggle store plan (Free <-> Pro)
     */
    public function upgradePlan(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['success' => false, 'message' => 'Katalog / Store tidak ditemukan.'], 404);
        }

        $targetPlan = $request->input('plan', 'pro');
        $store->update(['plan' => $targetPlan]);

        return response()->json([
            'success' => true,
            'message' => 'Plan toko berhasil diperbarui ke ' . strtoupper($targetPlan) . '!',
            'data' => $store
        ]);
    }

    /**
     * Add master category option for the store
     */
    public function addMasterOption(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['success' => false, 'message' => 'Katalog / Store tidak ditemukan.'], 404);
        }

        $request->validate([
            'field' => 'required|string',
            'value' => 'required|string',
        ]);

        $field = $request->field;
        $value = trim($request->value);

        if (!$value) {
            return response()->json(['success' => false, 'message' => 'Nilai tidak boleh kosong.'], 400);
        }

        $column = $this->getMasterColumn($field);
        if (!$column) {
            return response()->json(['success' => false, 'message' => 'Kolom kategori tidak valid.'], 400);
        }

        $list = $store->$column ?: [];
        if (!in_array($value, $list)) {
            $list[] = $value;
            $store->update([$column => array_values($list)]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Opsi berhasil ditambahkan.',
            'data' => $store->$column
        ]);
    }

    /**
     * Delete master category option for the store
     */
    public function deleteMasterOption(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['success' => false, 'message' => 'Katalog / Store tidak ditemukan.'], 404);
        }

        $request->validate([
            'field' => 'required|string',
            'value' => 'required|string',
            'replacement' => 'required|string',
        ]);

        $field = $request->field;
        $value = $request->value;
        $replacement = $request->replacement;

        $column = $this->getMasterColumn($field);
        if (!$column) {
            return response()->json(['success' => false, 'message' => 'Kolom kategori tidak valid.'], 400);
        }

        // 1. Update all fauna items using this option
        if ($field === 'class') {
            Fauna::where('store_id', $store->id)->where('class', $value)->update(['class' => $replacement]);
        } elseif ($field === 'habitat') {
            Fauna::where('store_id', $store->id)->where('habitat', $value)->update(['habitat' => $replacement]);
        } elseif ($field === 'conservation_status') {
            Fauna::where('store_id', $store->id)->where('conservation_status', $value)->update(['conservation_status' => $replacement]);
        } elseif ($field === 'shipping_coverage') {
            $faunas = Fauna::where('store_id', $store->id)->where('detailed_info->shipping_coverage', $value)->get();
            foreach ($faunas as $fauna) {
                $info = $fauna->detailed_info;
                if (is_array($info)) {
                    $info['shipping_coverage'] = $replacement;
                }
                $fauna->detailed_info = $info;
                $fauna->save();
            }
        }

        // 2. Remove option from store options list
        $list = $store->$column ?: [];
        $list = array_filter($list, function($item) use ($value) {
            return $item !== $value;
        });
        if ($replacement && !in_array($replacement, $list)) {
            $list[] = $replacement;
        }

        $store->update([$column => array_values($list)]);

        return response()->json([
            'success' => true,
            'message' => 'Opsi berhasil dihapus dan diganti.',
            'data' => $store->$column
        ]);
    }

    /**
     * Rename master category option for the store and update all associated items atomically
     */
    public function renameMasterOption(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['success' => false, 'message' => 'Katalog / Store tidak ditemukan.'], 404);
        }

        $request->validate([
            'field' => 'required|string',
            'old_value' => 'required|string',
            'new_value' => 'required|string',
        ]);

        $field = $request->field;
        $oldValue = trim($request->old_value);
        $newValue = trim($request->new_value);

        if (empty($newValue)) {
            return response()->json(['success' => false, 'message' => 'Nama opsi baru tidak boleh kosong.'], 422);
        }

        $column = $this->getMasterColumn($field);
        if (!$column) {
            return response()->json(['success' => false, 'message' => 'Kolom kategori tidak valid.'], 400);
        }

        // 1. Atomically update all items using old_value
        if ($field === 'class') {
            Fauna::where('store_id', $store->id)->where('class', $oldValue)->update(['class' => $newValue]);
        } elseif ($field === 'habitat') {
            Fauna::where('store_id', $store->id)->where('habitat', $oldValue)->update(['habitat' => $newValue]);
        } elseif ($field === 'conservation_status') {
            Fauna::where('store_id', $store->id)->where('conservation_status', $oldValue)->update(['conservation_status' => $newValue]);
        } elseif ($field === 'shipping_coverage') {
            $faunas = Fauna::where('store_id', $store->id)->where('detailed_info->shipping_coverage', $oldValue)->get();
            foreach ($faunas as $fauna) {
                $info = $fauna->detailed_info;
                if (is_array($info)) {
                    $info['shipping_coverage'] = $newValue;
                }
                $fauna->detailed_info = $info;
                $fauna->save();
            }
        }

        // 2. Update store's master list
        $list = $store->$column ?: [];
        $updatedList = array_map(function($item) use ($oldValue, $newValue) {
            return $item === $oldValue ? $newValue : $item;
        }, $list);

        // Ensure uniqueness
        $updatedList = array_values(array_unique($updatedList));
        $store->update([$column => $updatedList]);

        return response()->json([
            'success' => true,
            'message' => 'Nama opsi berhasil diubah dan disinkronkan.',
            'data' => $store->$column
        ]);
    }

    /**
     * Apply industry preset master data templates for the store
     */
    public function applyMasterPreset(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['success' => false, 'message' => 'Katalog / Store tidak ditemukan.'], 404);
        }

        $request->validate([
            'preset' => 'required|string|in:physical,digital,fauna,service,food,general'
        ]);

        $preset = $request->preset;
        $presets = [
            'physical' => [
                'master_classes' => ['Pakaian & Busana', 'Aksesoris & Fashion', 'Gadget & Elektronik', 'Kebutuhan Rumah Tangga', 'Kerajinan Tangan'],
                'master_habitats' => ['Baru (Brand New)', 'Bekas (Preloved)', 'Kualitas Super', 'General'],
                'master_statuses' => ['Tersedia (Ready Stock)', 'Pre-Order (PO)', 'Stok Terbatas'],
                'master_shipping_coverages' => ['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (Pickup)']
            ],
            'digital' => [
                'master_classes' => ['E-Book & Panduan', 'Source Code & Script', 'Template Desain', 'Video & Audio Materi', 'Tools & Aset Digital'],
                'master_habitats' => ['Lisensi Personal', 'Lisensi Komersial', 'Extended License', 'Free Download'],
                'master_statuses' => ['Akses Instan (Instant Download)', 'Update Gratis Seumur Hidup', 'Kuota Terbatas'],
                'master_shipping_coverages' => ['Pengiriman Digital Otomatis', 'Kirim via Email / Cloud', 'Akses Manual via Chat']
            ],
            'fauna' => [
                'master_classes' => ['Reptil & Amfibi', 'Ikan Hias & Aquascape', 'Burung Kicau & Unggas', 'Mamalia Hias', 'Pakan & Perlengkapan Kandang'],
                'master_habitats' => ['Air Tawar', 'Air Laut', 'Terestrial (Darat)', 'Arboreal (Pohon)'],
                'master_statuses' => ['Tersedia (Ready Stock)', 'Habis Terjual (Sold Out)', 'Booking / DP (Reserved)'],
                'master_shipping_coverages' => ['Ekspedisi Khusus Hewan (Se-Indonesia)', 'Jalur Kereta / Bus (Pulau Jawa Saja)', 'Ambil Sendiri di Lokasi (No Shipping)']
            ],
            'service' => [
                'master_classes' => ['Konsultasi & Advice', 'Desain & Kreatif', 'Perbaikan & Servis', 'Kursus & Pelatihan', 'Pembuatan Web & Aplikasi'],
                'master_habitats' => ['Sesi 1 Jam', 'Paket Project Penuh', 'Langganan Bulanan', 'Konsultasi Singkat'],
                'master_statuses' => ['Jadwal Terbuka (Available)', 'Kuota Penuh (Booked)', 'By Appointment'],
                'master_shipping_coverages' => ['Layanan di Tempat Pelanggan (On-Site)', 'Datang ke Lokasi Workshop', 'Remote / Online via Video Call']
            ],
            'food' => [
                'master_classes' => ['Makanan Utama / Berat', 'Camilan & Snack', 'Minuman Olahan & Kopi', 'Frozen Food Siap Masak', 'Paket Katering / Bento'],
                'master_habitats' => ['Siap Saji (Hot / Fresh)', 'Minuman Dingin / Segar', 'Frozen Food (-18°C)', 'Tahan Suhu Ruang'],
                'master_statuses' => ['Ready Hari Ini (Ready Stock)', 'Pre-Order H-1 (PO)', 'Habis Terjual (Sold Out)'],
                'master_shipping_coverages' => ['Instant Delivery (Ojol Max 2 Jam)', 'Pax Delivery (Same Day)', 'Ambil di Outlet (Dine In / Takeaway)']
            ],
            'general' => [
                'master_classes' => ['Kategori Utama', 'Koleksi Populer', 'Item Unggulan', 'Varian Baru', 'Promo Spesial'],
                'master_habitats' => ['Standar', 'Premium', 'Edisi Khusus', 'General'],
                'master_statuses' => ['Tersedia (Ready Stock)', 'Pre-Order (PO)', 'Habis Terjual (Sold Out)'],
                'master_shipping_coverages' => ['Bisa Kirim se-Indonesia', 'Area Terbatas', 'Ambil Sendiri di Toko (Pickup)']
            ]
        ];

        $data = $presets[$preset] ?? $presets['general'];
        $store->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Preset master data industri berhasil diterapkan!',
            'data' => [
                'master_classes' => $store->master_classes,
                'master_habitats' => $store->master_habitats,
                'master_statuses' => $store->master_statuses,
                'master_shipping_coverages' => $store->master_shipping_coverages,
            ]
        ]);
    }

    private function getMasterColumn($field)
    {
        switch ($field) {
            case 'class': return 'master_classes';
            case 'habitat': return 'master_habitats';
            case 'conservation_status': return 'master_statuses';
            case 'shipping_coverage': return 'master_shipping_coverages';
            default: return null;
        }
    }
}

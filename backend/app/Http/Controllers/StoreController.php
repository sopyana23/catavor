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

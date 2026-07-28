<?php

namespace App\Http\Controllers;

use App\Models\Fauna;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FaunaController extends Controller
{
    public function index(Request $request)
    {
        // Public listings are fallback if no store is scoped.
        // We will default to retrieve all faunas with their store scope details.
        $query = Fauna::withCount('sightings');

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

    public function show($id)
    {
        $fauna = Fauna::with(['sightings' => function($q) {
            $q->latest();
        }])->find($id);

        if (!$fauna) {
            return response()->json([
                'success' => false,
                'message' => 'Hewan tidak ditemukan.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $fauna
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json([
                'success' => false,
                'message' => 'Toko Anda belum terdaftar.'
            ], 404);
        }

        // Check plan limits (Free plan max 10 items)
        if (($store->plan ?? 'free') === 'free' && $store->faunas()->count() >= 10) {
            return response()->json([
                'success' => false,
                'message' => 'Batas postingan Plan Gratis telah tercapai (Maksimal 10 item). Silakan upgrade ke Plan Pro untuk posting tanpa batas!'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'scientific_name' => 'nullable|string|max:255',
            'class' => 'required|string|max:255',
            'habitat' => 'nullable|string|max:255',
            'diet' => 'nullable|string|max:255',
            'conservation_status' => 'nullable|string|max:255',
            'price' => 'required|integer|min:0',
            'video_url' => 'nullable|string|url',
            'is_shipping_available' => 'required|boolean',
            'description' => 'required|string',
            'image_url' => 'required|string|url',
            'detailed_info' => 'nullable|array',
            'product_type' => 'nullable|string|in:physical,digital,fauna,service,food',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();
        $data['store_id'] = $store->id;
        $data['scientific_name'] = $data['scientific_name'] ?? 'N/A';
        $data['habitat'] = $data['habitat'] ?? 'General';
        $data['diet'] = $data['diet'] ?? 'N/A';
        $data['conservation_status'] = $data['conservation_status'] ?? 'Tersedia';

        $fauna = Fauna::create($data);

        // Update store's master lists categories
        $this->updateStoreMasterList($store, 'master_classes', $fauna->class);
        $this->updateStoreMasterList($store, 'master_habitats', $fauna->habitat);
        $this->updateStoreMasterList($store, 'master_statuses', $fauna->conservation_status);
        
        $detailedInfo = $fauna->detailed_info;
        if (is_array($detailedInfo) && isset($detailedInfo['shipping_coverage'])) {
            $this->updateStoreMasterList($store, 'master_shipping_coverages', $detailedInfo['shipping_coverage']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Postingan hewan berhasil ditambahkan!',
            'data' => $fauna
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $fauna = Fauna::find($id);

        if (!$fauna) {
            return response()->json([
                'success' => false,
                'message' => 'Hewan tidak ditemukan.'
            ], 404);
        }

        $user = $request->user();
        $store = $user->store;

        if (!$store || $fauna->store_id !== $store->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki wewenang mengedit postingan ini.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'scientific_name' => 'nullable|string|max:255',
            'class' => 'required|string|max:255',
            'habitat' => 'nullable|string|max:255',
            'diet' => 'nullable|string|max:255',
            'conservation_status' => 'nullable|string|max:255',
            'price' => 'required|integer|min:0',
            'video_url' => 'nullable|string|url',
            'is_shipping_available' => 'required|boolean',
            'description' => 'required|string',
            'image_url' => 'required|string|url',
            'detailed_info' => 'nullable|array',
            'product_type' => 'nullable|string|in:physical,digital,fauna,service,food',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $fauna->update($validator->validated());

        // Update store's master lists categories
        $this->updateStoreMasterList($store, 'master_classes', $fauna->class);
        $this->updateStoreMasterList($store, 'master_habitats', $fauna->habitat);
        $this->updateStoreMasterList($store, 'master_statuses', $fauna->conservation_status);
        
        $detailedInfo = $fauna->detailed_info;
        if (is_array($detailedInfo) && isset($detailedInfo['shipping_coverage'])) {
            $this->updateStoreMasterList($store, 'master_shipping_coverages', $detailedInfo['shipping_coverage']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Postingan hewan berhasil diperbarui!',
            'data' => $fauna
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $fauna = Fauna::find($id);

        if (!$fauna) {
            return response()->json([
                'success' => false,
                'message' => 'Hewan tidak ditemukan.'
            ], 404);
        }

        $user = $request->user();
        $store = $user->store;

        if (!$store || $fauna->store_id !== $store->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.'
            ], 403);
        }

        $fauna->delete();

        return response()->json([
            'success' => true,
            'message' => 'Postingan hewan berhasil dihapus!'
        ]);
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120', // max 5MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'File harus berupa gambar (jpeg, png, jpg, webp) maks 5MB.',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('image');
        $extension = $file->getClientOriginalExtension();
        $filename = \Illuminate\Support\Str::random(20) . '.' . $extension;
        
        $destinationPath = storage_path('app/public/fauna');
        if (!file_exists($destinationPath)) {
            mkdir($destinationPath, 0755, true);
        }

        $targetFile = $destinationPath . '/' . $filename;
        $tempPath = $file->getRealPath();

        $optimized = false;

        if (extension_loaded('gd')) {
            try {
                list($width, $height, $type) = getimagesize($tempPath);

                $img = null;
                if ($type === IMAGETYPE_JPEG) {
                    $img = imagecreatefromjpeg($tempPath);
                } elseif ($type === IMAGETYPE_PNG) {
                    $img = imagecreatefrompng($tempPath);
                } elseif ($type === IMAGETYPE_WEBP) {
                    if (function_exists('imagecreatefromwebp')) {
                        $img = imagecreatefromwebp($tempPath);
                    }
                }

                if ($img) {
                    $maxDim = 1200;
                    if ($width > $maxDim || $height > $maxDim) {
                        if ($width > $height) {
                            $newWidth = $maxDim;
                            $newHeight = (int)($height * ($maxDim / $width));
                        } else {
                            $newHeight = $maxDim;
                            $newWidth = (int)($width * ($maxDim / $height));
                        }

                        $newImg = imagecreatetruecolor($newWidth, $newHeight);
                        
                        if ($type === IMAGETYPE_PNG) {
                            imagealphablending($newImg, false);
                            imagesavealpha($newImg, true);
                            $transparent = imagecolorallocatealpha($newImg, 255, 255, 255, 127);
                            imagefilledrectangle($newImg, 0, 0, $newWidth, $newHeight, $transparent);
                        }

                        imagecopyresampled($newImg, $img, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                        imagedestroy($img);
                        $img = $newImg;
                    }

                    if ($type === IMAGETYPE_PNG) {
                        imagepng($img, $targetFile, 6);
                    } elseif ($type === IMAGETYPE_WEBP && function_exists('imagewebp')) {
                        imagewebp($img, $targetFile, 80);
                    } else {
                        imagejpeg($img, $targetFile, 80);
                    }

                    imagedestroy($img);
                    $optimized = true;
                }
            } catch (\Exception $e) {
                // Ignore and fallback
            }
        }

        if (!$optimized) {
            $file->move($destinationPath, $filename);
        }

        $url = url('storage/fauna/' . $filename);

        return response()->json([
            'success' => true,
            'url' => $url
        ]);
    }

    private function updateStoreMasterList($store, $column, $value)
    {
        $list = $store->$column ?: [];
        if ($value && !in_array($value, $list)) {
            $list[] = $value;
            $store->update([$column => array_values($list)]);
        }
    }
}

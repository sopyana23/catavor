<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStoreOwnership
{
    /**
     * Handle an incoming request.
     * Ensure the authenticated user owns the store targeted by the header/request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        $userStore = $user->store;
        if (!$userStore) {
            return response()->json([
                'success' => false,
                'message' => 'Akses Ditolak. Akun Anda belum memiliki katalog terdaftar.'
            ], 403);
        }

        // Check if client provided X-Store-Slug header or store_slug input
        $targetSlug = $request->header('X-Store-Slug') ?? $request->input('store_slug');

        if ($targetSlug) {
            $targetSlugClean = strtolower(trim($targetSlug));
            $userStoreSlugClean = strtolower(trim($userStore->slug));

            if ($targetSlugClean !== $userStoreSlugClean) {
                return response()->json([
                    'success' => false,
                    'message' => "Akses API Ditolak (403 Forbidden). Sesi autentikasi Anda adalah milik pengelola katalog \"{$userStore->slug}\", tidak berhak mengelola atau mengakses data katalog \"{$targetSlugClean}\"."
                ], 403);
            }
        }

        return $next($request);
    }
}

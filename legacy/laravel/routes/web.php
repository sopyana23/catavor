<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\File;

Route::get('/{any?}', function () {
    $userAgent = Request::header('User-Agent');
    
    // Simple but robust mobile browser / OS regex + query param + header check
    $isMobile = preg_match('/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i', $userAgent)
                || Request::query('view') === 'mobile'
                || Request::header('Sec-CH-UA-Mobile') === '?1';

    if ($isMobile) {
        $path = public_path('mobile/index.html');
        if (File::exists($path)) {
            return response(File::get($path))
                ->header('Content-Type', 'text/html')
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
        }
        return response("Mobile frontend hasn't been compiled yet. Please run `.\\build-all.ps1` at root.", 200)
            ->header('Content-Type', 'text/html');
    } else {
        $path = public_path('desktop/index.html');
        if (File::exists($path)) {
            return response(File::get($path))
                ->header('Content-Type', 'text/html')
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
        }
        return response("Desktop frontend hasn't been compiled yet. Please run `.\\build-all.ps1` at root.", 200)
            ->header('Content-Type', 'text/html');
    }
})->where('any', '^(?!api|sanctum|_debugbar).*$');

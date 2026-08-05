<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\DB::table('stores')
    ->where('about_slogan', 'LIKE', '%Komitmen Layanan%')
    ->orWhere('about_slogan', '=', 'Komitmen Layanan Profesional & Kualitas Terbaik')
    ->update(['about_slogan' => 'Katalog Resmi Produk & Informasi Bisnis']);

\DB::table('stores')
    ->where('store_slogan', 'LIKE', '%Komitmen Layanan%')
    ->orWhere('store_slogan', '=', 'Komitmen Layanan Profesional & Kualitas Terbaik')
    ->update(['store_slogan' => 'Katalog Resmi Produk & Informasi Bisnis']);

echo "Database updated successfully.\n";

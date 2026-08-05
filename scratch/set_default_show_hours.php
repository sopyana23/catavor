<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\DB::table('stores')->update(['show_hours' => false]);

echo "Updated show_hours to false for all stores in DB.\n";

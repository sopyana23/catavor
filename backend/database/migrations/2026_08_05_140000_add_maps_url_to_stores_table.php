<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            if (!Schema::hasColumn('stores', 'about_maps_url')) {
                $table->text('about_maps_url')->nullable()->after('about_location');
            }
            if (!Schema::hasColumn('stores', 'enable_maps')) {
                $table->boolean('enable_maps')->default(false)->after('about_maps_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            if (Schema::hasColumn('stores', 'about_maps_url')) {
                $table->dropColumn('about_maps_url');
            }
            if (Schema::hasColumn('stores', 'enable_maps')) {
                $table->dropColumn('enable_maps');
            }
        });
    }
};

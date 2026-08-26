<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('stores', 'show_hours')) {
            Schema::table('stores', function (Blueprint $table) {
                $table->boolean('show_hours')->default(false)->after('about_hours');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('stores', 'show_hours')) {
            Schema::table('stores', function (Blueprint $table) {
                $table->dropColumn('show_hours');
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('faunas', function (Blueprint $table) {
            if (!Schema::hasColumn('faunas', 'product_type')) {
                $table->string('product_type', 30)->default('physical');
            }
            if (!Schema::hasColumn('faunas', 'attributes')) {
                $table->json('attributes')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('faunas', function (Blueprint $table) {
            if (Schema::hasColumn('faunas', 'product_type')) {
                $table->dropColumn('product_type');
            }
            if (Schema::hasColumn('faunas', 'attributes')) {
                $table->dropColumn('attributes');
            }
        });
    }
};

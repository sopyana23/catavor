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
        Schema::table('stores', function (Blueprint $table) {
            $table->string('plan')->default('free')->after('slug'); // 'free' or 'pro'
            $table->boolean('enable_wa_direct')->default(true)->after('whatsapp_number');
            $table->boolean('enable_wa_rekber')->default(true)->after('enable_wa_direct');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['plan', 'enable_wa_direct', 'enable_wa_rekber']);
        });
    }
};

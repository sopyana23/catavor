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
        Schema::create('faunas', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('scientific_name');
            $table->string('class');
            $table->string('habitat');
            $table->string('diet');
            $table->string('conservation_status');
            $table->text('description');
            $table->string('image_url');
            $table->json('detailed_info')->nullable();
            $table->unsignedBigInteger('price')->default(0);
            $table->string('video_url')->nullable();
            $table->boolean('is_shipping_available')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('faunas');
    }
};

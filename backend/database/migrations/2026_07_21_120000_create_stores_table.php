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
        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('slug')->unique();
            $table->string('store_title')->default('DFauna');
            $table->string('store_slogan')->nullable();
            $table->string('store_logo_url')->nullable();
            $table->text('whatsapp_number')->nullable();
            $table->text('promo_banner')->nullable();
            
            // About Us details
            $table->string('about_title')->nullable();
            $table->string('about_slogan')->nullable();
            $table->text('about_description')->nullable();
            $table->string('about_location')->nullable();
            $table->text('about_hours')->nullable();
            $table->text('about_disclaimer')->nullable();
            $table->text('about_cards')->nullable(); // JSON Array
            
            // Social Links & Master Data options
            $table->text('social_links')->nullable(); // JSON Array
            $table->text('master_classes')->nullable(); // JSON Array
            $table->text('master_habitats')->nullable(); // JSON Array
            $table->text('master_statuses')->nullable(); // JSON Array
            $table->text('master_shipping_coverages')->nullable(); // JSON Array

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};

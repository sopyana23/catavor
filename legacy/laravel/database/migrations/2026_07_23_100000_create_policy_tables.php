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
        Schema::create('policy_versions', function (Blueprint $table) {
            $table->id();
            $table->string('policy_type'); // 'terms', 'privacy', 'acceptable_use'
            $table->string('version'); // 'v1.0.0'
            $table->string('title');
            $table->longText('content');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['policy_type', 'version']);
        });

        Schema::create('user_policy_agreements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('store_slug')->nullable();
            $table->string('policy_type'); // 'terms', 'privacy', 'acceptable_use'
            $table->string('version'); // 'v1.0.0'
            $table->longText('content_snapshot'); // Exact snapshot of what they agreed to
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('agreed_at');
            $table->timestamps();

            $table->index(['user_id', 'policy_type']);
            $table->index(['store_slug', 'policy_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_policy_agreements');
        Schema::dropIfExists('policy_versions');
    }
};

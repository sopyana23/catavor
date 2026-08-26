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
        Schema::table('articles', function (Blueprint $table) {
            $table->boolean('require_comment_approval')->default(false);
            $table->boolean('require_comment_email')->default(false);
            $table->boolean('verify_comment_email_domain')->default(false);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->constrained('comments')->onDelete('cascade');
            $table->string('status')->default('approved'); // 'pending', 'approved'
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['require_comment_approval', 'require_comment_email', 'verify_comment_email_domain']);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'status']);
        });
    }
};

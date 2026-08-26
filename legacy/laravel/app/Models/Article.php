<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    protected $fillable = [
        'title',
        'content',
        'image_url',
        'author',
        'read_time',
        'slug',
        'meta_description',
        'is_comments_enabled',
        'require_comment_approval',
        'require_comment_email',
        'verify_comment_email_domain'
    ];

    protected $casts = [
        'is_comments_enabled' => 'boolean',
        'require_comment_approval' => 'boolean',
        'require_comment_email' => 'boolean',
        'verify_comment_email_domain' => 'boolean'
    ];

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolicyVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'policy_type',
        'version',
        'title',
        'content',
        'published_at'
    ];

    protected $casts = [
        'published_at' => 'datetime'
    ];
}

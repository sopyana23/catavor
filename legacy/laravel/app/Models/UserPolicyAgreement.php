<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserPolicyAgreement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'store_slug',
        'policy_type',
        'version',
        'content_snapshot',
        'ip_address',
        'user_agent',
        'agreed_at'
    ];

    protected $casts = [
        'agreed_at' => 'datetime'
    ];
}

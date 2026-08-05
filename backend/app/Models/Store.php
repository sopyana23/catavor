<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    protected $fillable = [
        'user_id',
        'slug',
        'plan',
        'payment_status',
        'payment_proof_url',
        'store_title',
        'store_slogan',
        'store_logo_url',
        'store_theme',
        'registration_timezone',
        'whatsapp_number',
        'enable_wa_direct',
        'enable_wa_rekber',
        'promo_banner',
        'about_title',
        'about_slogan',
        'about_description',
        'about_location',
        'about_maps_url',
        'enable_maps',
        'about_hours',
        'show_hours',
        'about_disclaimer',
        'about_cards',
        'social_links',
        'official_website',
        'master_classes',
        'master_habitats',
        'master_statuses',
        'master_shipping_coverages'
    ];

    protected $casts = [
        'enable_wa_direct' => 'boolean',
        'enable_wa_rekber' => 'boolean',
        'show_hours' => 'boolean',
        'enable_maps' => 'boolean',
        'about_cards' => 'array',
        'social_links' => 'array',
        'master_classes' => 'array',
        'master_habitats' => 'array',
        'master_statuses' => 'array',
        'master_shipping_coverages' => 'array'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function faunas()
    {
        return $this->hasMany(Fauna::class);
    }
}

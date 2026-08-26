<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Fauna extends Model
{
    protected $fillable = [
        'name',
        'scientific_name',
        'class',
        'habitat',
        'diet',
        'conservation_status',
        'description',
        'image_url',
        'detailed_info',
        'price',
        'video_url',
        'is_shipping_available',
        'store_id',
        'product_type',
        'attributes'
    ];

    protected $casts = [
        'detailed_info' => 'array',
        'price' => 'integer',
        'is_shipping_available' => 'boolean',
        'attributes' => 'array'
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function sightings()
    {
        return $this->hasMany(Sighting::class);
    }
}

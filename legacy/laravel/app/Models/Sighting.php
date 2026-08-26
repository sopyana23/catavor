<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sighting extends Model
{
    protected $fillable = [
        'fauna_id',
        'observer_name',
        'location',
        'notes',
        'observed_at',
        'latitude',
        'longitude'
    ];

    protected $casts = [
        'observed_at' => 'date',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function fauna()
    {
        return $this->belongsTo(Fauna::class);
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Sighting;
use Illuminate\Support\Facades\Validator;

class SightingController extends Controller
{
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fauna_id' => 'required|exists:faunas,id',
            'observer_name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'observed_at' => 'required|date',
            'notes' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $sighting = Sighting::create($validator->validated());

        // Load the fauna relationship for the response
        $sighting->load('fauna');

        return response()->json([
            'success' => true,
            'message' => 'Laporan penampakan satwa berhasil dikirim!',
            'data' => $sighting
        ], 201);
    }
}

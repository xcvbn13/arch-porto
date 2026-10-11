<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProfileResource;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    public function show(): JsonResponse|ProfileResource
    {
        $profile = Profile::query()->first();

        if (! $profile) {
            return response()->json(['message' => 'Profile not found. Run the seeder (php artisan db:seed).'], 404);
        }

        return new ProfileResource($profile);
    }
}

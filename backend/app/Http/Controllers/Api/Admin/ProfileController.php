<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'role' => ['required', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'bio' => ['required', 'string', 'max:20000'],
            'email' => ['nullable', 'string', 'email:rfc', 'max:254'],
            'github_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
            'linkedin_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
            'resume_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
            'website_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
            'avatar_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
        ]);

        Profile::query()->updateOrCreate(['id' => 1], $data);

        Log::channel('admin')->info('Profile updated.', ['user_id' => (string) $request->user()?->id]);

        return response()->json(['data' => ['message' => 'Profile saved.']]);
    }
}

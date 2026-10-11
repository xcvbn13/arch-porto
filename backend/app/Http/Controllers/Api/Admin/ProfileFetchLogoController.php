<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Upload logo fetch (gambar kiri blok fastfetch/neofetch).
 * File disimpan di storage/app/avatars/logos dan disajikan lewat
 * GET /api/v1/files/logos/{filename}. Kosong → frontend memakai ASCII default.
 */
class ProfileFetchLogoController extends Controller
{
    private const DIR = 'logos';
    private const PREFIX = '/api/v1/files/logos/';

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
        ]);

        $file = $request->file('logo');
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        Storage::disk('avatars')->putFileAs(self::DIR, $file, $filename);

        $profile = Profile::query()->firstOrCreate(['id' => 1], [
            'name' => 'Portfolio', 'role' => 'Owner', 'bio' => '',
        ]);
        $this->deleteOldLogo($profile);
        $profile->update(['fetch_logo_url' => self::PREFIX.$filename]);

        Log::channel('admin')->info('Fetch logo uploaded.', [
            'user_id' => (string) $request->user()?->id, 'filename' => $filename,
        ]);

        return response()->json(['data' => ['logo_url' => $profile->fetch_logo_url]], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $profile = Profile::query()->first();
        if ($profile) {
            $this->deleteOldLogo($profile);
            $profile->update(['fetch_logo_url' => null]);
        }

        Log::channel('admin')->info('Fetch logo deleted.', ['user_id' => (string) $request->user()?->id]);

        return response()->json(['data' => ['message' => 'Logo deleted (ASCII default aktif).']]);
    }

    private function deleteOldLogo(?Profile $profile): void
    {
        if (! $profile?->fetch_logo_url) {
            return;
        }
        if (str_starts_with($profile->fetch_logo_url, self::PREFIX)) {
            $name = substr($profile->fetch_logo_url, strlen(self::PREFIX));
            if (preg_match('/^[A-Za-z0-9._-]{1,120}$/', $name)) {
                Storage::disk('avatars')->delete(self::DIR.'/'.$name);
            }
        }
    }
}

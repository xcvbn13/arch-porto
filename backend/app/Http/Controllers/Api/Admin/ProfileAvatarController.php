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
 * Upload avatar pemilik (multipart, admin-only).
 * File disimpan di storage/app/avatars dan disajikan lewat
 * GET /api/v1/files/avatars/{filename} (baca publik, nama tervalidasi).
 * Avatar lama dihapus saat diganti.
 */
class ProfileAvatarController extends Controller
{
    private const DIR = 'avatars';

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
        ]);

        $file = $request->file('avatar');
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        Storage::disk('avatars')->putFileAs('', $file, $filename);

        $profile = Profile::query()->firstOrCreate(['id' => 1], [
            'name' => 'Portfolio', 'role' => 'Owner', 'bio' => '',
        ]);
        $this->deleteOldAvatar($profile);
        $profile->update(['avatar_url' => '/api/v1/files/'.self::DIR.'/'.$filename]);

        Log::channel('admin')->info('Avatar uploaded.', [
            'user_id' => (string) $request->user()?->id, 'filename' => $filename,
        ]);

        return response()->json(['data' => ['avatar_url' => $profile->avatar_url]], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $profile = Profile::query()->first();
        if ($profile) {
            $this->deleteOldAvatar($profile);
            $profile->update(['avatar_url' => null]);
        }

        Log::channel('admin')->info('Avatar deleted.', ['user_id' => (string) $request->user()?->id]);

        return response()->json(['data' => ['message' => 'Avatar deleted.']]);
    }

    private function deleteOldAvatar(?Profile $profile): void
    {
        if (! $profile?->avatar_url) {
            return;
        }
        $prefix = '/api/v1/files/'.self::DIR.'/';
        if (str_starts_with($profile->avatar_url, $prefix)) {
            $name = substr($profile->avatar_url, strlen($prefix));
            if (preg_match('/^[A-Za-z0-9._-]{1,120}$/', $name)) {
                Storage::disk('avatars')->delete($name);
            }
        }
    }
}

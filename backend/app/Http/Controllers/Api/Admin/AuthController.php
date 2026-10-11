<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * Autentikasi admin lewat perintah `sudo su` di terminal.
 * Login hanya dengan password untuk akun root PERTAMA di daftar seeder
 * (database/seeders/data/admins.php) — sesuai semangat "sudo su → root".
 * Rate limit (10/menit/IP) + lockout 15 menit setelah 5 kegagalan beruntun.
 * Tidak pernah mencatat password.
 */
class AuthController extends Controller
{
    private const MAX_FAILURES = 5;
    private const LOCKOUT_SECONDS = 900;

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'max:512'],
        ]);

        $ip = (string) $request->ip();
        $lockKey = 'admin.lockout.'.$ip;
        $failKey = 'admin.fail.'.$ip;

        $lockedUntil = (int) Cache::get($lockKey, 0);
        if ($lockedUntil > time()) {
            return response()->json([
                'message' => 'Too many failed attempts. Try again later.',
                'retry_after' => $lockedUntil - time(),
            ], 423);
        }

        // Cocokkan password terhadap SEMUA akun root (daftar seeder
        // seeders/data/admins.php) — urutan sesuai id, akun pertama daftar
        // diprioritaskan. Ini mendukung "list akun root" dari seeder.
        $admins = User::query()->where('is_admin', true)->orderBy('id')->get();
        $matched = $admins->first(fn (User $candidate) => Hash::check($data['password'], $candidate->password_hash));

        if (! $matched) {
            $fails = (int) Cache::get($failKey, 0) + 1;
            if ($fails >= self::MAX_FAILURES) {
                Cache::put($lockKey, time() + self::LOCKOUT_SECONDS, self::LOCKOUT_SECONDS);
                Cache::forget($failKey);
                Log::channel('admin')->warning('Admin login locked out.', ['ip' => $ip]);

                return response()->json([
                    'message' => 'Too many failed attempts. Try again later.',
                    'retry_after' => self::LOCKOUT_SECONDS,
                ], 423);
            }
            Cache::put($failKey, $fails, self::LOCKOUT_SECONDS);
            Log::channel('admin')->warning('Admin login failed.', ['ip' => $ip, 'attempt' => $fails]);

            return response()->json(['message' => 'Sorry, try again.'], 401);
        }

        Cache::forget($lockKey);
        Cache::forget($failKey);

        Auth::guard('web')->login($matched);
        $request->session()->regenerate();

        Log::channel('admin')->info('Admin logged in.', ['user_id' => $matched->id]);

        // Enter-token sekali pakai (TTL 60 detik): dipakai shell `config-admin`
        // untuk membawa sesi login ke browser lewat /admin/enter?token=…
        $enterToken = bin2hex(random_bytes(16));
        Cache::put('admin.enter.'.$enterToken, $matched->id, 60);

        return response()->json([
            'data' => [
                'name' => $matched->name,
                'email' => $matched->email,
                'enter_url' => rtrim((string) config('app.url'), '/').'/admin/enter?token='.$enterToken,
            ],
        ]);
    }

    /**
     * Konsumsi enter-token dari shell `config-admin`: login sesi browser
     * lalu redirect ke panel /admin. Token sekali pakai.
     */
    public function enter(Request $request): \Illuminate\Http\RedirectResponse
    {
        $token = (string) $request->query('token', '');
        $userId = Cache::pull('admin.enter.'.$token);

        if ($userId === null) {
            return redirect('/admin?enter=failed');
        }

        $user = \App\Models\User::query()->find($userId);
        if (! $user || ! $user->is_admin) {
            return redirect('/admin?enter=failed');
        }

        Auth::guard('web')->login($user);
        session()->regenerate();

        Log::channel('admin')->info('Admin entered via shell token.', ['user_id' => $user->id]);

        return redirect('/admin');
    }

    public function logout(Request $request): JsonResponse
    {
        $userId = Auth::guard('web')->id();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Log::channel('admin')->info('Admin logged out.', ['user_id' => $userId]);

        return response()->json(['data' => ['message' => 'Logged out.']]);
    }

    public function me(): JsonResponse
    {
        $user = Auth::guard('web')->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json(['data' => ['name' => $user->name, 'email' => $user->email]]);
    }
}

<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Rate limiter berbasis IP. Contact dibatasi ketat (anti spam);
        // pembuatan sesi PTY dibatasi (1 sesi = 1 proses bash nyata).
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by((string) $request->ip());
        });

        RateLimiter::for('contact', function (Request $request) {
            return Limit::perMinute(3)->by((string) $request->ip());
        });

        // Login admin (sudo): ketat — dikombinasikan dengan lockout di AuthController.
        // Batas 10/menit sengaja di atas ambang lockout (5) agar lockout yang
        // menangani percobaan beruntun, bukan throttle.
        RateLimiter::for('admin-login', function (Request $request) {
            return Limit::perMinute(10)->by((string) $request->ip());
        });

        // Pembuatan sesi PTY: wajar untuk refresh beruntun, tetap membatasi
        // brute-force pembukaan sesi (1 sesi = 1 proses bash nyata).
        RateLimiter::for('pty-session', function (Request $request) {
            return Limit::perMinute(10)->by((string) $request->ip());
        });
    }
}

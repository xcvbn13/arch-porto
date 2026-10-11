<?php

use App\Http\Controllers\Api\Admin\AuthController as AdminAuthController;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

// Login dari shell `config-admin`: konsumsi enter-token → sesi → redirect /admin.
// (Bukan /api/* — ini jalur browser; Nginx mem-proxy /admin/enter ke backend.)
Route::get('/admin/enter', [AdminAuthController::class, 'enter'])
    ->middleware(EncryptCookies::class, StartSession::class);

// Backend hanya melayani API; halaman frontend disajikan oleh service Nginx.
Route::get('/', function () {
    return response()->json([
        'name' => 'imam-portfolio API',
        'version' => 'v1',
        'docs' => 'See README.md — semua endpoint ada di /api/v1/*',
        'health' => '/up',
    ]);
});

<?php

use App\Http\Controllers\Api\Admin\AdminCrudController;
use App\Http\Controllers\Api\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Api\Admin\CertificationFileController;
use App\Http\Controllers\Api\Admin\ContactMessagesController;
use App\Http\Controllers\Api\Admin\FetchEntryController;
use App\Http\Controllers\Api\Admin\PasswordController;
use App\Http\Controllers\Api\Admin\ProfileAvatarController;
use App\Http\Controllers\Api\Admin\ProfileController as AdminProfileController;
use App\Http\Controllers\Api\Admin\ProfileFetchLogoController;
use App\Http\Controllers\Api\Admin\ProjectScreenshotsController;
use App\Http\Controllers\Api\Admin\TerminalStyleController as AdminTerminalStyleController;
use App\Http\Controllers\Api\FetchController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\CertificationController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\EducationController;
use App\Http\Controllers\Api\ExperienceController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\PublicationController;
use App\Http\Controllers\Api\PtySessionController;
use App\Http\Controllers\Api\TerminalStyleController;
use App\Http\Controllers\Api\SkillController;
use Illuminate\Support\Facades\Route;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;

/*
|--------------------------------------------------------------------------
| API Portfolio — prefix /api/v1
|--------------------------------------------------------------------------
| Endpoint baca bersifat publik (data portfolio). Satu-satunya jalur tulis
| adalah POST /contact (divalidasi + rate-limited), /pty/sessions
| (rate-limited; shell Arch read-only opsional),
| dan /admin/* (sesi admin + middleware EnsureAdmin).
|--------------------------------------------------------------------------
*/

// ---- Admin: login dari terminal (`sudo`) ----
Route::post('/admin/login', [AdminAuthController::class, 'login'])
    ->middleware('throttle:admin-login', EncryptCookies::class, StartSession::class);

// ---- Admin: semua jalur tulis di belakang sesi admin ----
Route::prefix('admin')->middleware(['admin', EncryptCookies::class, StartSession::class])->group(function () {
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::get('/me', [AdminAuthController::class, 'me']);
    Route::put('/password', [PasswordController::class, 'update']);
    Route::put('/profile', [AdminProfileController::class, 'update']);
    Route::post('/profile/avatar', [ProfileAvatarController::class, 'store']);
    Route::delete('/profile/avatar', [ProfileAvatarController::class, 'destroy']);
    Route::post('/profile/fetch-logo', [ProfileFetchLogoController::class, 'store']);
    Route::delete('/profile/fetch-logo', [ProfileFetchLogoController::class, 'destroy']);

    Route::get('/fetch', [FetchEntryController::class, 'index']);
    Route::post('/fetch', [FetchEntryController::class, 'store']);
    Route::put('/fetch/{id}', [FetchEntryController::class, 'update'])->whereNumber('id');
    Route::delete('/fetch/{id}', [FetchEntryController::class, 'destroy'])->whereNumber('id');
    Route::put('/fetch-layout', [FetchEntryController::class, 'updateLayout']);

    Route::put('/terminal-style', [AdminTerminalStyleController::class, 'update']);

    Route::post('/projects/{id}/screenshots', [ProjectScreenshotsController::class, 'store'])->whereNumber('id');
    Route::delete('/projects/{id}/screenshots/{filename}', [ProjectScreenshotsController::class, 'destroy'])
        ->whereNumber('id')->where('filename', '[A-Za-z0-9._-]{1,120}');

    Route::post('/certifications/{id}/file', [CertificationFileController::class, 'store'])->whereNumber('id');
    Route::delete('/certifications/{id}/file', [CertificationFileController::class, 'destroy'])->whereNumber('id');

    Route::get('/contact-messages', [ContactMessagesController::class, 'index']);
    Route::delete('/contact-messages/{id}', [ContactMessagesController::class, 'destroy'])->whereNumber('id');

    Route::get('/{entity}', [AdminCrudController::class, 'index'])
        ->whereIn('entity', ['skills', 'projects', 'experience', 'education', 'certifications', 'publications']);
    Route::post('/{entity}', [AdminCrudController::class, 'store'])
        ->whereIn('entity', ['skills', 'projects', 'experience', 'education', 'certifications', 'publications']);
    Route::put('/{entity}/{id}', [AdminCrudController::class, 'update'])
        ->whereIn('entity', ['skills', 'projects', 'experience', 'education', 'certifications', 'publications'])
        ->whereNumber('id');
    Route::delete('/{entity}/{id}', [AdminCrudController::class, 'destroy'])
        ->whereIn('entity', ['skills', 'projects', 'experience', 'education', 'certifications', 'publications'])
        ->whereNumber('id');
});

Route::middleware('throttle:api')->group(function () {
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::get('/skills', [SkillController::class, 'index']);
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{id}', [ProjectController::class, 'show'])->whereNumber('id');
    Route::get('/experience', [ExperienceController::class, 'index']);
    Route::get('/education', [EducationController::class, 'index']);
    Route::get('/certifications', [CertificationController::class, 'index']);
    Route::get('/publications', [PublicationController::class, 'index']);

    // Config tampilan fetch (fastfetch/neofetch/banner) — data publik.
    Route::get('/fetch', [FetchController::class, 'index']);

    // Style terminal (tema xterm + prompt) — data publik.
    Route::get('/terminal-style', [TerminalStyleController::class, 'show']);

    // Tiket sesi PTY (shell Arch read-only) — bridge memverifikasi via internal.
    Route::post('/pty/sessions', [PtySessionController::class, 'store'])
        ->middleware('throttle:pty-session', EncryptCookies::class, StartSession::class);
    Route::get('/pty/verify/{ticket}', [PtySessionController::class, 'verify'])
        ->where('ticket', '[a-f0-9]{32}');

    // File portfolio yang di-upload (avatar, logo fetch) — baca publik,
    // direktori di-allowlist + nama divalidasi ketat.
    Route::get('/files/{dir}/{filename}', [FileController::class, 'file'])
        ->whereIn('dir', ['avatars', 'logos', 'screenshots', 'certificates'])
        ->where('filename', '[A-Za-z0-9._-]{1,120}');
});

Route::post('/contact', [ContactController::class, 'store'])
    ->middleware('throttle:contact');

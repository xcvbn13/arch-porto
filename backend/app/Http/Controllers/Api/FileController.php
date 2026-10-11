<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Penyaji file portfolio yang di-upload (avatar).
 * Baca publik, TANPA jalur dari input arbitrer: nama file dibatasi regex
 * di route + realpath diverifikasi berada di direktori avatar.
 */
class FileController extends Controller
{
    /** Subdirektori yang boleh disajikan (allowlist) — avatars disimpan di
     *  root disk, sisanya di subdirektori masing-masing. */
    private const DIR_MAP = [
        'avatars' => '',
        'logos' => 'logos',
        'screenshots' => 'screenshots',
        'certificates' => 'certificates',
    ];

    public function file(string $dir, string $filename): Response|JsonResponse|BinaryFileResponse
    {
        if (! array_key_exists($dir, self::DIR_MAP)) {
            return response()->json(['message' => 'Not found.'], 404);
        }
        // Route sudah membatasi charset via where() — verifikasi ulang (defense in depth)
        if (! preg_match('/^[A-Za-z0-9._-]{1,120}$/', $filename)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $sub = self::DIR_MAP[$dir];
        $path = Storage::disk('avatars')->path(($sub !== '' ? $sub.'/' : '').$filename);
        $real = realpath($path);
        $root = realpath(Storage::disk('avatars')->path(''));

        if ($real === false || $root === false || ! str_starts_with($real, $root.DIRECTORY_SEPARATOR)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        return response()->file($real, ['Cache-Control' => 'public, max-age=3600']);
    }
}

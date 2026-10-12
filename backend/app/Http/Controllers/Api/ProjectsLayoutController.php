<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;

/**
 * Style gambar detail project (canvas + gambar inline): ukuran, jarak,
 * tipografi. Publik; null di DB = default bawaan.
 */
class ProjectsLayoutController extends Controller
{
    public const DEFAULTS = [
        'logo_width' => 180,
        'logo_height' => 120,
        'gap' => 14,
        'shot_gap' => 8,
        'font_size' => 13,
        'line_height' => 17,
        'text_width' => 420,
    ];

    public function show(): JsonResponse
    {
        $layout = Profile::query()->first()?->projects_layout;

        return response()->json([
            'data' => array_merge(self::DEFAULTS, is_array($layout) ? $layout : []),
        ]);
    }
}

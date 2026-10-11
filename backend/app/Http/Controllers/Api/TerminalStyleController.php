<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;

/**
 * Style terminal (tema xterm + prompt shell) — publik, satu baris profil.
 * null di DB = default bawaan.
 */
class TerminalStyleController extends Controller
{
    public const DEFAULTS = [
        'background' => '#0c0f14',
        'foreground' => '#d4d9e0',
        'accent' => '#00d787',
        'cursor' => '#00d787',
        'font_size' => 14,
        'blink' => true,
        'font_family' => 'JetBrains Mono',
        'font_weight' => 'normal',
        'letter_spacing' => 0,
        'line_height' => 1.0,
        'padding' => 8,
        'cursor_style' => 'block',
        'selection_color' => '#2a313d',
        'opacity' => 1,
    ];

    public function show(): JsonResponse
    {
        $style = Profile::query()->first()?->terminal_style;

        return response()->json([
            'data' => array_merge(self::DEFAULTS, is_array($style) ? $style : []),
        ]);
    }
}

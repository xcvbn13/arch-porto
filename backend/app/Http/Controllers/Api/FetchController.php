<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FetchEntry;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;

/**
 * Config tampilan fetch (fastfetch/neofetch/banner): daftar komponen
 * + logo (gambar opsional; null = ASCII default di frontend) + layout.
 */
class FetchController extends Controller
{
    public const LAYOUT_DEFAULTS = [
        'logo_width' => 180,
        'logo_height' => 200,
        'gap' => 14,
        'font_size' => 13,
        'line_height' => 17,
        'text_width' => 420,
    ];

    public function index(): JsonResponse
    {
        $layout = Profile::query()->first()?->fetch_layout;

        return response()->json([
            'data' => [
                'entries' => FetchEntry::query()
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get(['label', 'value'])
                    ->values(),
                'logo_url' => Profile::query()->first()?->fetch_logo_url,
                'layout' => array_merge(self::LAYOUT_DEFAULTS, is_array($layout) ? $layout : []),
            ],
        ]);
    }
}

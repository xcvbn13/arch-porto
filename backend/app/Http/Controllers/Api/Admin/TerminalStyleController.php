<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TerminalStyleController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'background' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'foreground' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'cursor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'font_size' => ['required', 'integer', 'between:11,22'],
            'blink' => ['required', 'boolean'],
            'font_family' => ['required', 'string', 'max:100'],
            'font_weight' => ['required', 'regex:/^(normal|bold|[1-9]00)$/'],
            'letter_spacing' => ['required', 'numeric', 'between:0,10'],
            'line_height' => ['required', 'numeric', 'between:0.9,2'],
            'padding' => ['required', 'integer', 'between:0,48'],
            'cursor_style' => ['required', 'in:block,bar,underline'],
            'selection_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'opacity' => ['required', 'numeric', 'between:0.6,1'],
        ]);

        $profile = Profile::query()->firstOrCreate(['id' => 1], [
            'name' => 'Portfolio', 'role' => 'Owner', 'bio' => '',
        ]);
        $profile->update(['terminal_style' => $data]);

        Log::channel('admin')->info('Terminal style updated.', [
            'user_id' => (string) $request->user()?->id,
        ]);

        return response()->json(['data' => $data]);
    }
}

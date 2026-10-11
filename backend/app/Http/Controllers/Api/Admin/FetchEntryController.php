<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FetchEntry;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FetchEntryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => FetchEntry::query()->orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'value' => ['required', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        // Baris baru tanpa sort_order → ditaruh di urutan terakhir
        $data['sort_order'] ??= ((int) FetchEntry::query()->max('sort_order')) + 1;

        $row = FetchEntry::query()->create($data);

        Log::channel('admin')->info('Admin created fetch entry.', [
            'user_id' => (string) $request->user()?->id, 'id' => $row->id,
        ]);

        return response()->json(['data' => $row->fresh()], 201);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'value' => ['required', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $row = FetchEntry::query()->find($id);
        if (! $row) {
            return response()->json(['message' => 'Fetch entry not found.'], 404);
        }

        $row->update($data);

        Log::channel('admin')->info('Admin updated fetch entry.', [
            'user_id' => (string) $request->user()?->id, 'id' => $id,
        ]);

        return response()->json(['data' => $row->fresh()]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $row = FetchEntry::query()->find($id);
        if (! $row) {
            return response()->json(['message' => 'Fetch entry not found.'], 404);
        }

        $row->delete();

        Log::channel('admin')->info('Admin deleted fetch entry.', [
            'user_id' => (string) $request->user()?->id, 'id' => $id,
        ]);

        return response()->json(['data' => ['message' => 'Deleted.']]);
    }

    /** Layout banner welcome (ukuran logo, jarak, tipografi). */
    public function updateLayout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'logo_width' => ['required', 'integer', 'between:40,480'],
            'logo_height' => ['required', 'integer', 'between:40,480'],
            'gap' => ['required', 'integer', 'between:0,96'],
            'font_size' => ['required', 'integer', 'between:9,28'],
            'line_height' => ['required', 'integer', 'between:10,48'],
            'text_width' => ['required', 'integer', 'between:160,600'],
        ]);

        $profile = Profile::query()->firstOrCreate(['id' => 1], [
            'name' => 'Portfolio', 'role' => 'Owner', 'bio' => '',
        ]);
        $profile->update(['fetch_layout' => $data]);

        Log::channel('admin')->info('Fetch layout updated.', [
            'user_id' => (string) $request->user()?->id,
        ]);

        return response()->json(['data' => $data]);
    }

    /** Layout canvas about (foto kiri + teks kanan). */
    public function updateAboutLayout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'logo_width' => ['required', 'integer', 'between:40,480'],
            'logo_height' => ['required', 'integer', 'between:40,480'],
            'gap' => ['required', 'integer', 'between:0,96'],
            'font_size' => ['required', 'integer', 'between:9,28'],
            'line_height' => ['required', 'integer', 'between:10,48'],
            'text_width' => ['required', 'integer', 'between:160,1000'],
        ]);

        $profile = Profile::query()->firstOrCreate(['id' => 1], [
            'name' => 'Portfolio', 'role' => 'Owner', 'bio' => '',
        ]);
        $profile->update(['about_layout' => $data]);

        Log::channel('admin')->info('About layout updated.', [
            'user_id' => (string) $request->user()?->id,
        ]);

        return response()->json(['data' => $data]);
    }
}

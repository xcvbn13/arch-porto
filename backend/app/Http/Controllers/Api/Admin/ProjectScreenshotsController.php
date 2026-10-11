<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Upload/hapus screenshot proyek (multipart). File disimpan di
 * storage/app/avatars/screenshots (volume persisten) dan disajikan lewat
 * /api/v1/files/screenshots/{file}. projects.screenshots menyimpan path.
 */
class ProjectScreenshotsController extends Controller
{
    private const DIR = 'screenshots';
    private const PREFIX = '/api/v1/files/screenshots/';

    public function store(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'screenshot' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
        ]);

        $project = Project::query()->find($id);
        if (! $project) {
            return response()->json(['message' => 'Project not found.'], 404);
        }

        $file = $request->file('screenshot');
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        Storage::disk('avatars')->putFileAs(self::DIR, $file, $filename);

        $screenshots = $project->screenshots ?? [];
        $screenshots[] = self::PREFIX.$filename;
        $project->update(['screenshots' => $screenshots]);

        Log::channel('admin')->info('Screenshot uploaded.', [
            'user_id' => (string) $request->user()?->id, 'project' => $id, 'filename' => $filename,
        ]);

        return response()->json(['data' => $project->fresh()->screenshots], 201);
    }

    public function destroy(int $id, string $filename, Request $request): JsonResponse
    {
        $project = Project::query()->find($id);
        if (! $project) {
            return response()->json(['message' => 'Project not found.'], 404);
        }

        if (! preg_match('/^[A-Za-z0-9._-]{1,120}$/', $filename)) {
            return response()->json(['message' => 'Invalid filename.'], 422);
        }

        $screenshots = array_values(array_filter(
            $project->screenshots ?? [],
            fn (string $u) => $u !== self::PREFIX.$filename,
        ));
        $project->update(['screenshots' => $screenshots]);

        Storage::disk('avatars')->delete(self::DIR.'/'.$filename);

        Log::channel('admin')->info('Screenshot deleted.', [
            'user_id' => (string) $request->user()?->id, 'project' => $id, 'filename' => $filename,
        ]);

        return response()->json(['data' => $screenshots]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        return ProjectResource::collection(
            Project::query()
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->paginate($perPage),
        );
    }

    public function show(int $id): JsonResponse|ProjectResource
    {
        $project = Project::query()->find($id);

        if (! $project) {
            return response()->json(['message' => 'Project not found.'], 404);
        }

        return new ProjectResource($project);
    }
}

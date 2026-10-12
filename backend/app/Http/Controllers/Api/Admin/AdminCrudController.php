<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certification;
use App\Models\Education;
use App\Models\Experience;
use App\Models\Project;
use App\Models\Publication;
use App\Models\Skill;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * CRUD generik admin untuk entitas portfolio.
 * `ENTITIES` adalah ALLOWLIST: hanya nama entitas di peta ini yang diterima
 * (route memakai whereIn). Model dan aturan validasi TIDAK diambil dari
 * input pengguna. Panel admin selalu mengirim payload lengkap saat update.
 */
class AdminCrudController extends Controller
{
    private const ENTITIES = [
        'skills' => [
            'model' => Skill::class,
            'rules' => [
                'category' => ['required', 'string', 'max:80'],
                'name' => ['required', 'string', 'max:120'],
                'level' => ['nullable', 'in:Trainee,Entry-Level,Mid-Level,Senior'],
                'description' => ['nullable', 'string', 'max:500'],
            ],
        ],
        'projects' => [
            'model' => Project::class,
            'rules' => [
                'title' => ['required', 'string', 'max:255'],
                'summary' => ['required', 'string', 'max:500'],
                'description' => ['required', 'string', 'max:20000'],
                'problem' => ['nullable', 'string', 'max:20000'],
                'contribution' => ['nullable', 'string', 'max:20000'],
                'architecture' => ['nullable', 'string', 'max:20000'],
                'stack' => ['nullable', 'array'],
                'stack.*' => ['string', 'max:80'],
                'repo_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
                'demo_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
                'metrics' => ['nullable', 'array'],
                'screenshots' => ['nullable', 'array'],
                'screenshots.*' => ['string', 'url:http,https', 'max:255'],
                'year' => ['nullable', 'string', 'max:10'],
                'featured' => ['boolean'],
                'sort_order' => ['nullable', 'integer'],
            ],
        ],
        'experience' => [
            'model' => Experience::class,
            'rules' => [
                'company' => ['required', 'string', 'max:255'],
                'role' => ['required', 'string', 'max:255'],
                'period_start' => ['required', 'string', 'max:20'],
                'period_end' => ['nullable', 'string', 'max:20'],
                'summary' => ['nullable', 'string', 'max:20000'],
                'highlights' => ['nullable', 'array'],
                'highlights.*' => ['string', 'max:500'],
                'sort_order' => ['nullable', 'integer'],
            ],
        ],
        'education' => [
            'model' => Education::class,
            'rules' => [
                'institution' => ['required', 'string', 'max:255'],
                'degree' => ['required', 'string', 'max:255'],
                'field' => ['nullable', 'string', 'max:255'],
                'period_start' => ['nullable', 'string', 'max:20'],
                'period_end' => ['nullable', 'string', 'max:20'],
                'summary' => ['nullable', 'string', 'max:20000'],
                'sort_order' => ['nullable', 'integer'],
            ],
        ],
        'certifications' => [
            'model' => Certification::class,
            'rules' => [
                'name' => ['required', 'string', 'max:255'],
                'issuer' => ['required', 'string', 'max:255'],
                'year' => ['nullable', 'string', 'max:10'],
                'credential_url' => ['nullable', 'string', 'url:http,https', 'max:255'],
            ],
        ],
        'publications' => [
            'model' => Publication::class,
            'rules' => [
                'title' => ['required', 'string', 'max:255'],
                'venue' => ['nullable', 'string', 'max:255'],
                'year' => ['nullable', 'string', 'max:10'],
                'url' => ['nullable', 'string', 'url:http,https', 'max:255'],
                'summary' => ['nullable', 'string', 'max:20000'],
            ],
        ],
    ];

    public function index(string $entity): JsonResponse
    {
        $model = self::ENTITIES[$entity]['model'];
        $query = $model::query();

        // Entitas ber-`sort_order` tampil mengikuti urutan publiknya
        // (ascending); lainnya terbaru dulu.
        $query = in_array('sort_order', (new $model)->getFillable(), true)
            ? $query->orderBy('sort_order')->orderByDesc('id')
            : $query->orderByDesc('id');

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(string $entity, Request $request): JsonResponse
    {
        $data = $request->validate(self::ENTITIES[$entity]['rules']);
        $model = self::ENTITIES[$entity]['model'];

        $row = $model::query()->create($data);

        Log::channel('admin')->info('Admin created row.', [
            'user_id' => (string) $request->user()?->id, 'entity' => $entity, 'id' => $row->id,
        ]);

        return response()->json(['data' => $row->fresh()], 201);
    }

    public function update(string $entity, int $id, Request $request): JsonResponse
    {
        $data = $request->validate(self::ENTITIES[$entity]['rules']);
        $model = self::ENTITIES[$entity]['model'];

        /** @var Model|null $row */
        $row = $model::query()->find($id);
        if (! $row) {
            return response()->json(['message' => ucfirst($entity).' row not found.'], 404);
        }

        $row->update($data);

        Log::channel('admin')->info('Admin updated row.', [
            'user_id' => (string) $request->user()?->id, 'entity' => $entity, 'id' => $row->id,
        ]);

        return response()->json(['data' => $row->fresh()]);
    }

    public function destroy(string $entity, int $id, Request $request): JsonResponse
    {
        $model = self::ENTITIES[$entity]['model'];

        /** @var Model|null $row */
        $row = $model::query()->find($id);
        if (! $row) {
            return response()->json(['message' => ucfirst($entity).' row not found.'], 404);
        }

        $row->delete();

        Log::channel('admin')->info('Admin deleted row.', [
            'user_id' => (string) $request->user()?->id, 'entity' => $entity, 'id' => $id,
        ]);

        return response()->json(['data' => ['message' => 'Deleted.']]);
    }
}

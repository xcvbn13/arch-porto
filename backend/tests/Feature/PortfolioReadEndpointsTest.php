<?php

namespace Tests\Feature;

use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortfolioReadEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_returns_seeded_profile(): void
    {
        $this->seed();

        $this->getJson('/api/v1/profile')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'name', 'role', 'tagline', 'bio', 'email',
                    'github_url', 'linkedin_url', 'resume_url', 'website_url',
                    'avatar_url',
                ],
            ]);
    }

    public function test_profile_and_projects_include_image_fields(): void
    {
        $this->seed();

        \App\Models\Profile::query()->update(['avatar_url' => 'https://example.invalid/a.png']);
        \App\Models\Project::query()->first()->update(['screenshots' => ['https://example.invalid/s.png']]);

        $this->getJson('/api/v1/profile')->assertJsonPath('data.avatar_url', 'https://example.invalid/a.png');
        $this->getJson('/api/v1/projects/1')->assertJsonPath('data.screenshots', ['https://example.invalid/s.png']);
    }

    public function test_profile_without_data_returns_404_json(): void
    {
        $this->getJson('/api/v1/profile')
            ->assertNotFound()
            ->assertJson(['message' => 'Profile not found. Run the seeder (php artisan db:seed).']);
    }

    public function test_skills_returns_list(): void
    {
        $this->seed();

        $this->getJson('/api/v1/skills')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'category', 'level']]])
            ->assertJsonCount(14, 'data');
    }

    public function test_skills_do_not_leak_private_fields(): void
    {
        $this->seed();

        $json = $this->getJson('/api/v1/skills')->json('data.0');
        $this->assertArrayNotHasKey('created_at', $json);
        $this->assertArrayNotHasKey('updated_at', $json);
        $this->assertArrayNotHasKey('password', $json);
        $this->assertArrayNotHasKey('app_key', $json);
    }

    public function test_projects_index_is_paginated(): void
    {
        $this->seed();

        $this->getJson('/api/v1/projects')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'title', 'summary', 'stack']],
                'meta' => ['current_page', 'last_page', 'total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_projects_index_ordered_by_sort_order_ascending_regardless_of_featured(): void
    {
        Project::query()->create(['title' => 'Alpha', 'summary' => 'a', 'description' => 'a', 'sort_order' => 9001]);
        Project::query()->create(['title' => 'Beta', 'summary' => 'b', 'description' => 'b', 'sort_order' => 9002]);
        Project::query()->create([
            'title' => 'Gamma', 'summary' => 'c', 'description' => 'c',
            'sort_order' => 9003, 'featured' => true,
        ]);

        $titles = $this->getJson('/api/v1/projects')->assertOk()->json('data.*.title');

        // Ascending by sort_order — proyek `featured` TIDAK dipin ke depan.
        $this->assertSame(['Alpha', 'Beta', 'Gamma'], array_slice($titles, -3));
    }

    public function test_projects_show_returns_detail(): void
    {
        $this->seed();

        $this->getJson('/api/v1/projects/1')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'id', 'title', 'summary', 'description', 'problem',
                    'contribution', 'architecture', 'stack', 'repo_url',
                    'demo_url', 'metrics', 'year',
                ],
            ]);
    }

    public function test_projects_show_unknown_id_returns_404(): void
    {
        $this->seed();

        $this->getJson('/api/v1/projects/9999')
            ->assertNotFound()
            ->assertJson(['message' => 'Project not found.']);
    }

    public function test_empty_collections_return_empty_data(): void
    {
        $this->seed();

        foreach (['experience', 'education', 'certifications', 'publications'] as $path) {
            $this->getJson("/api/v1/{$path}")
                ->assertOk()
                ->assertJson(['data' => []]);
        }
    }

    public function test_unknown_api_route_returns_json_404(): void
    {
        $this->getJson('/api/v1/tidak-ada')
            ->assertNotFound()
            ->assertJsonStructure(['message']);
    }

    public function test_internal_error_does_not_leak_details_or_credentials(): void
    {
        $this->seed();

        \Illuminate\Support\Facades\Route::get('/api/v1/bomb', function () {
            throw new \RuntimeException('SECRET_'.env('APP_KEY').'_INTERNAL_DETAIL');
        });

        $response = $this->getJson('/api/v1/bomb');
        $response->assertStatus(500);

        $body = (string) $response->getContent();
        $this->assertStringNotContainsString('SECRET_', $body);
        $this->assertStringNotContainsString('INTERNAL_DETAIL', $body);
        $this->assertStringNotContainsString('stack', $body);
        $this->assertStringNotContainsString('RuntimeException', $body);
    }

    public function test_unexpected_validation_error_never_exposes_model_details(): void
    {
        $this->seed();

        // id bukan numerik: route binding menolak dengan 404 JSON generik
        $this->getJson('/api/v1/projects/abc')->assertNotFound();
    }

    public function test_health_endpoint_responds(): void
    {
        $this->get('/up')->assertOk();
    }
}

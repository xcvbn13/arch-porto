<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AdminCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        // Login sebagai root (akun pertama daftar seeder) untuk semua test CRUD
        $admins = require base_path('database/seeders/data/admins.php');
        $this->postJson('/api/v1/admin/login', ['password' => $admins[0]['password']])->assertOk();
    }

    public function test_crud_requires_admin_session(): void
    {
        // test terpisah: tanpa login
        $this->postJson('/api/v1/admin/logout');

        $this->postJson('/api/v1/admin/skills', ['category' => 'x', 'name' => 'y'])
            ->assertUnauthorized();
    }

    public function test_skills_crud_roundtrip(): void
    {
        $this->postJson('/api/v1/admin/skills', [
            'category' => 'devops', 'name' => 'Kubernetes', 'level' => 'Entry-Level',
        ])->assertCreated();

        $id = Skill::query()->where('name', 'Kubernetes')->value('id');

        $this->putJson("/api/v1/admin/skills/{$id}", [
            'category' => 'devops', 'name' => 'Kubernetes', 'level' => 'Senior',
        ])->assertOk();

        $this->assertSame('Senior', Skill::query()->find($id)->level);

        $this->deleteJson("/api/v1/admin/skills/{$id}")->assertOk();
        $this->assertNull(Skill::query()->find($id));
    }

    public function test_store_validates_required_fields(): void
    {
        $this->postJson('/api/v1/admin/skills', ['category' => 'x'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_skills_level_must_be_one_of_the_allowed_options(): void
    {
        $this->postJson('/api/v1/admin/skills', [
            'category' => 'devops', 'name' => 'K8s', 'level' => 'advanced',
        ])->assertUnprocessable()->assertJsonValidationErrors(['level']);

        $this->postJson('/api/v1/admin/skills', [
            'category' => 'devops', 'name' => 'K8s', 'level' => 'Senior',
        ])->assertCreated();

        $this->postJson('/api/v1/admin/skills', [
            'category' => 'devops', 'name' => 'K8s-2',
        ])->assertCreated(); // tanpa level juga sah
    }

    public function test_update_unknown_row_returns_404(): void
    {
        $this->putJson('/api/v1/admin/skills/99999', ['category' => 'x', 'name' => 'y'])
            ->assertNotFound();
    }

    public function test_unknown_entity_is_rejected(): void
    {
        $this->getJson('/api/v1/admin/users')->assertNotFound();
        $this->postJson('/api/v1/admin/users', [])->assertNotFound();
    }

    public function test_projects_crud_with_json_fields(): void
    {
        $this->postJson('/api/v1/admin/projects', [
            'title' => 'Proyek Baru',
            'summary' => 'Ringkas',
            'description' => 'Deskripsi',
            'stack' => ['php', 'docker'],
            'metrics' => ['latency' => '10ms'],
            'featured' => true,
        ])->assertCreated();

        $project = Project::query()->where('title', 'Proyek Baru')->first();
        $this->assertSame(['php', 'docker'], $project->stack);
        $this->assertSame(['latency' => '10ms'], $project->metrics);
        $this->assertTrue($project->featured);

        $this->putJson("/api/v1/admin/projects/{$project->id}", [
            'title' => 'Proyek Baru',
            'summary' => 'Ringkas',
            'description' => 'Deskripsi baru',
        ])->assertOk();

        $this->deleteJson("/api/v1/admin/projects/{$project->id}")->assertOk();
    }

    public function test_projects_rejects_invalid_url(): void
    {
        $this->postJson('/api/v1/admin/projects', [
            'title' => 'X',
            'summary' => 'Y',
            'description' => 'Z',
            'repo_url' => 'javascript:alert(1)',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['repo_url']);
    }

    public function test_projects_accepts_screenshots_and_rejects_bad_ones(): void
    {
        $this->postJson('/api/v1/admin/projects', [
            'title' => 'Dengan Gambar',
            'summary' => 'Y',
            'description' => 'Z',
            'screenshots' => ['https://example.invalid/1.png'],
        ])->assertCreated();

        $this->postJson('/api/v1/admin/projects', [
            'title' => 'Gambar Buruk',
            'summary' => 'Y',
            'description' => 'Z',
            'screenshots' => ['javascript:alert(1)'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['screenshots.0']);
    }

    public function test_profile_update_accepts_avatar_url(): void
    {
        $this->putJson('/api/v1/admin/profile', [
            'name' => 'Imam',
            'role' => 'Fullstack Developer',
            'bio' => 'Bio',
            'avatar_url' => 'https://example.invalid/avatar.png',
        ])->assertOk();

        $this->getJson('/api/v1/profile')->assertJsonPath('data.avatar_url', 'https://example.invalid/avatar.png');
    }

    public function test_experience_crud(): void
    {
        $this->postJson('/api/v1/admin/experience', [
            'company' => 'PT Contoh', 'role' => 'Engineer', 'period_start' => '2020',
            'highlights' => ['membangun X'],
        ])->assertCreated();

        $this->getJson('/api/v1/admin/experience')
            ->assertOk()
            ->assertJsonPath('data.0.company', 'PT Contoh');
    }

    public function test_education_certifications_publications_crud(): void
    {
        $this->postJson('/api/v1/admin/education', [
            'institution' => 'Universitas Contoh', 'degree' => 'S1',
        ])->assertCreated();

        $this->postJson('/api/v1/admin/certifications', [
            'name' => 'Cert X', 'issuer' => 'Lembaga Y',
        ])->assertCreated();

        $this->postJson('/api/v1/admin/publications', [
            'title' => 'Paper Z',
        ])->assertCreated();

        foreach (['education', 'certifications', 'publications'] as $entity) {
            $this->getJson("/api/v1/admin/{$entity}")->assertOk()->assertJsonCount(1, 'data');
        }
    }

    public function test_profile_update(): void
    {
        $this->putJson('/api/v1/admin/profile', [
            'name' => 'Imam Baru',
            'role' => 'Fullstack Developer',
            'bio' => 'Bio diperbarui dari panel admin.',
            'github_url' => 'https://github.com/contoh',
        ])->assertOk();

        $this->getJson('/api/v1/profile')->assertJsonPath('data.name', 'Imam Baru');
    }

    public function test_project_screenshots_upload_serve_delete(): void
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

        $res = $this->post('/api/v1/admin/projects/1/screenshots', [
            'screenshot' => UploadedFile::fake()->createWithContent('shot.png', $png),
        ])->assertCreated();

        $list = $res->json('data');
        $this->assertCount(1, $list);
        $this->assertStringStartsWith('/api/v1/files/screenshots/', $list[0]);

        $this->get($list[0])->assertOk()->assertHeader('Content-Type', 'image/png');

        // Hapus
        $name = basename($list[0]);
        $this->deleteJson("/api/v1/admin/projects/1/screenshots/{$name}")
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->get($list[0])->assertNotFound();
    }

    public function test_screenshot_upload_rejects_non_image_and_unknown_project(): void
    {
        $this->post('/api/v1/admin/projects/1/screenshots', [
            'screenshot' => UploadedFile::fake()->createWithContent('x.txt', 'bukan gambar'),
        ])->assertUnprocessable();

        $this->post('/api/v1/admin/projects/99999/screenshots', [
            'screenshot' => UploadedFile::fake()->createWithContent('x.png', 'x'),
        ])->assertNotFound();
    }

    public function test_certification_file_upload_serve_delete(): void
    {
        $this->postJson('/api/v1/admin/certifications', [
            'name' => 'Cert X', 'issuer' => 'Lembaga Y',
        ])->assertCreated();

        $res = $this->post('/api/v1/admin/certifications/1/file', [
            'file' => UploadedFile::fake()->createWithContent('cert.pdf', '%PDF-1.4 test'),
        ])->assertCreated();

        $url = $res->json('data.file_url');
        $this->assertStringStartsWith('/api/v1/files/certificates/', $url);

        $this->get($url)->assertOk();
        $this->getJson('/api/v1/certifications')
            ->assertJsonPath('data.0.file_url', 'http://localhost'.$url); // absolut di endpoint publik

        $this->deleteJson('/api/v1/admin/certifications/1/file')->assertOk();
        $this->get($url)->assertNotFound();
        $this->getJson('/api/v1/certifications')->assertJsonPath('data.0.file_url', null);
    }

    public function test_certification_file_rejects_bad_type(): void
    {
        $this->postJson('/api/v1/admin/certifications', [
            'name' => 'Cert Z', 'issuer' => 'Lembaga Y',
        ])->assertCreated();

        $this->post('/api/v1/admin/certifications/1/file', [
            'file' => UploadedFile::fake()->createWithContent('x.sh', '#!/bin/sh'),
        ])->assertUnprocessable();
    }

    public function test_contact_messages_list_and_delete(): void    {
        ContactMessage::query()->create([
            'name' => 'Pengunjung', 'email' => 'p@example.com', 'message' => 'Halo',
        ]);

        $this->getJson('/api/v1/admin/contact-messages')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'message']]]);

        $this->deleteJson('/api/v1/admin/contact-messages/1')->assertOk();
        $this->assertSame(0, ContactMessage::query()->count());
    }

    public function test_contact_messages_list_is_paginated(): void
    {
        for ($i = 0; $i < 5; $i++) {
            ContactMessage::query()->create([
                'name' => "P{$i}", 'email' => "p{$i}@example.com", 'message' => 'x',
            ]);
        }

        $this->getJson('/api/v1/admin/contact-messages')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'total']])
            ->assertJsonPath('meta.total', 5);
    }
}

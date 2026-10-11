<?php

namespace Tests\Feature;

use App\Models\FetchEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class FetchConfigTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $admins = require base_path('database/seeders/data/admins.php');
        $this->postJson('/api/v1/admin/login', ['password' => $admins[0]['password']])->assertOk();
    }

    protected function tearDown(): void
    {
        foreach (glob(storage_path('app/avatars/*/*')) ?: [] as $f) {
            @unlink($f);
        }
        parent::tearDown();
    }

    public function test_seeder_creates_default_fetch_rows_only_when_empty(): void
    {
        $this->assertSame(11, FetchEntry::query()->count());

        // Ubah dari panel → seeder ulang tidak menimpa
        FetchEntry::query()->first()->update(['value' => 'diedit admin']);
        $this->seed();
        $this->assertSame('diedit admin', FetchEntry::query()->first()->value);
    }

    public function test_public_fetch_endpoint_returns_entries_logo_and_layout(): void
    {
        $this->getJson('/api/v1/fetch')
            ->assertOk()
            ->assertJsonStructure(['data' => ['entries', 'logo_url', 'layout']])
            ->assertJsonPath('data.entries.0.label', 'Name')
            ->assertJsonPath('data.logo_url', null)
            ->assertJsonPath('data.layout.logo_width', 180)
            ->assertJsonPath('data.layout.gap', 14);
    }

    public function test_admin_can_update_fetch_layout(): void
    {
        $this->putJson('/api/v1/admin/fetch-layout', [
            'logo_width' => 240,
            'logo_height' => 260,
            'gap' => 24,
            'font_size' => 15,
            'line_height' => 20,
            'text_width' => 500,
        ])->assertOk();

        $this->getJson('/api/v1/fetch')
            ->assertJsonPath('data.layout.logo_width', 240)
            ->assertJsonPath('data.layout.gap', 24)
            ->assertJsonPath('data.layout.font_size', 15)
            ->assertJsonPath('data.layout.text_width', 500);
    }

    public function test_fetch_layout_validation(): void
    {
        $this->putJson('/api/v1/admin/fetch-layout', [
            'logo_width' => 10, // di bawah 40
            'logo_height' => 260,
            'gap' => 24,
            'font_size' => 15,
            'line_height' => 20,
            'text_width' => 420,
        ])->assertUnprocessable()->assertJsonValidationErrors(['logo_width']);

        $this->putJson('/api/v1/admin/fetch-layout', [
            'logo_width' => 240,
            'logo_height' => 260,
            'gap' => 200, // di atas 96
            'font_size' => 15,
            'line_height' => 20,
            'text_width' => 420,
        ])->assertUnprocessable()->assertJsonValidationErrors(['gap']);

        $this->putJson('/api/v1/admin/fetch-layout', [
            'logo_width' => 240,
            'logo_height' => 260,
            'gap' => 24,
            'font_size' => 15,
            'line_height' => 20,
            'text_width' => 700, // di atas 600
        ])->assertUnprocessable()->assertJsonValidationErrors(['text_width']);
    }

    public function test_admin_crud_on_fetch_entries(): void
    {
        $this->postJson('/api/v1/admin/fetch', ['label' => 'Hobi', 'value' => 'Membaca'])
            ->assertCreated();

        $id = FetchEntry::query()->where('label', 'Hobi')->value('id');

        // Baris baru tanpa sort_order → di urutan terakhir
        $this->assertSame(11, FetchEntry::query()->find($id)->sort_order);

        $this->putJson("/api/v1/admin/fetch/{$id}", ['label' => 'Hobi', 'value' => 'Ngeblog'])
            ->assertOk();
        $this->assertSame('Ngeblog', FetchEntry::query()->find($id)->value);

        $this->deleteJson("/api/v1/admin/fetch/{$id}")->assertOk();
        $this->assertNull(FetchEntry::query()->find($id));
    }

    public function test_fetch_entries_require_label_and_value(): void
    {
        $this->postJson('/api/v1/admin/fetch', ['label' => 'Tanpa Value'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['value']);

        $this->postJson('/api/v1/admin/fetch', [])->assertUnprocessable();
    }

    public function test_fetch_entries_require_admin(): void
    {
        $this->postJson('/api/v1/admin/logout');
        $this->postJson('/api/v1/admin/fetch', ['label' => 'x', 'value' => 'y'])
            ->assertUnauthorized();
    }

    public function test_fetch_logo_upload_serve_and_delete(): void
    {
        $res = $this->post('/api/v1/admin/profile/fetch-logo', [
            'logo' => UploadedFile::fake()->createWithContent('logo.png', base64_decode(self::PNG)),
        ])->assertCreated()
            ->assertJsonStructure(['data' => ['logo_url']]);

        $url = $res->json('data.logo_url');
        $this->assertStringStartsWith('/api/v1/files/logos/', $url);

        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->getJson('/api/v1/fetch')->assertJsonPath('data.logo_url', $url);

        // Traversal ditolak
        $this->get('/api/v1/files/logos/..%2F..%2F.env')->assertNotFound();
        $this->get('/api/v1/files/rahasia/x.png')->assertNotFound(); // dir di luar allowlist

        $this->delete('/api/v1/admin/profile/fetch-logo')->assertOk();
        $this->get($url)->assertNotFound();
        $this->getJson('/api/v1/fetch')->assertJsonPath('data.logo_url', null);
    }

    public function test_fetch_logo_rejects_non_image(): void
    {
        $this->post('/api/v1/admin/profile/fetch-logo', [
            'logo' => UploadedFile::fake()->createWithContent('x.txt', 'bukan gambar'),
        ])->assertUnprocessable();
    }
}

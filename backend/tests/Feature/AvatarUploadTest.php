<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AvatarUploadTest extends TestCase
{
    use RefreshDatabase;

    /** PNG 1x1 asli (base64) — agar rule `image` lolos tanpa GD. */
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
        // Bersihkan file upload hasil test
        foreach (glob(storage_path('app/avatars/*')) ?: [] as $f) {
            @unlink($f);
        }
        parent::tearDown();
    }

    public function test_avatar_requires_admin_session(): void
    {
        $this->postJson('/api/v1/admin/logout');

        $this->post('/api/v1/admin/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('a.png', base64_decode(self::PNG)),
        ])->assertUnauthorized();
    }

    public function test_upload_serve_and_delete_avatar(): void
    {
        $res = $this->post('/api/v1/admin/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('a.png', base64_decode(self::PNG)),
        ])->assertCreated()
            ->assertJsonStructure(['data' => ['avatar_url']]);

        $url = $res->json('data.avatar_url');
        $this->assertStringStartsWith('/api/v1/files/avatars/', $url);

        // Disajikan publik dengan content-type gambar
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');

        // Profil publik menunjuk ke file tersaji
        $this->getJson('/api/v1/profile')->assertJsonPath('data.avatar_url', $url);

        // Path traversal ditolak (route regex + realpath)
        $this->get('/api/v1/files/avatars/..%2F..%2F.env')->assertNotFound();
        $this->get('/api/v1/files/avatars/.env')->assertNotFound();
        $this->get('/api/v1/files/avatars/nonexistent.png')->assertNotFound();

        // Hapus avatar
        $this->delete('/api/v1/admin/profile/avatar')->assertOk();
        $this->get($url)->assertNotFound();
        $this->getJson('/api/v1/profile')->assertJsonPath('data.avatar_url', null);
    }

    public function test_upload_rejects_non_image(): void
    {
        $this->post('/api/v1/admin/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('x.txt', 'bukan gambar'),
        ])->assertUnprocessable();
    }

    public function test_upload_rejects_missing_file(): void
    {
        $this->post('/api/v1/admin/profile/avatar', [])->assertUnprocessable();
    }

    public function test_replacing_avatar_removes_old_file(): void
    {
        $first = $this->post('/api/v1/admin/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('a.png', base64_decode(self::PNG)),
        ])->assertCreated()->json('data.avatar_url');

        $second = $this->post('/api/v1/admin/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('b.png', base64_decode(self::PNG)),
        ])->assertCreated()->json('data.avatar_url');

        $this->assertNotSame($first, $second);
        $this->get($first)->assertNotFound(); // file lama terhapus
        $this->get($second)->assertOk();
    }
}

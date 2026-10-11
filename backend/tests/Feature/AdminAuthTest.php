<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    private string $rootPassword;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Cache::flush();
        RateLimiter::clear('admin-login:127.0.0.1');

        // Password akun root = entri PERTAMA di seeders/data/admins.php
        $admins = require base_path('database/seeders/data/admins.php');
        $this->rootPassword = $admins[0]['password'];
    }

    private function login(string $password): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/admin/login', ['password' => $password]);
    }

    public function test_seeder_creates_the_root_account_list(): void
    {
        $admins = require base_path('database/seeders/data/admins.php');
        foreach ($admins as $admin) {
            $this->assertDatabaseHas('users', [
                'email' => $admin['email'],
                'is_admin' => true,
            ]);
        }
        $this->assertSame(count($admins), User::query()->where('is_admin', true)->count());
    }

    public function test_login_with_root_password_succeeds(): void
    {
        $this->login($this->rootPassword)
            ->assertOk()
            ->assertJsonStructure(['data' => ['name', 'email']]);

        $this->getJson('/api/v1/admin/me')->assertOk();
    }

    public function test_second_root_account_password_also_logs_in(): void
    {
        $admins = require base_path('database/seeders/data/admins.php');
        $this->assertGreaterThanOrEqual(2, count($admins), 'Seharusnya ada minimal dua akun root di seeder');

        $this->login($admins[1]['password'])->assertOk();
        $this->getJson('/api/v1/admin/me')
            ->assertOk()
            ->assertJsonPath('data.email', $admins[1]['email']);
    }

    public function test_login_with_wrong_password_fails(): void
    {
        $this->login('password-salah')
            ->assertUnauthorized()
            ->assertJson(['message' => 'Sorry, try again.']);

        $this->getJson('/api/v1/admin/me')->assertUnauthorized();
    }

    public function test_login_requires_password(): void
    {
        $this->postJson('/api/v1/admin/login', [])->assertUnprocessable();
        $this->postJson('/api/v1/admin/login', ['password' => str_repeat('a', 513)])->assertUnprocessable();
    }

    public function test_five_failures_lock_out_for_fifteen_minutes(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->login('salah')->assertUnauthorized();
        }
        // Kegagalan ke-5 → lockout
        $this->login('salah')->assertStatus(423);

        // Password benar pun ditolak selama lockout
        $this->login($this->rootPassword)
            ->assertStatus(423)
            ->assertJsonStructure(['message', 'retry_after']);
    }

    public function test_admin_endpoints_require_session(): void
    {
        foreach ([
            ['GET', '/api/v1/admin/me'],
            ['GET', '/api/v1/admin/skills'],
            ['PUT', '/api/v1/admin/profile'],
        ] as [$method, $uri]) {
            $this->json($method, $uri)->assertUnauthorized();
        }
    }

    public function test_non_admin_user_is_forbidden(): void
    {
        $user = User::query()->create([
            'name' => 'Bukan Admin',
            'email' => 'user@example.com',
            'password_hash' => 'password',
            'is_admin' => false,
        ]);

        $this->actingAs($user)->getJson('/api/v1/admin/me')->assertForbidden();
    }

    public function test_logout_invalidates_session(): void
    {
        $this->login($this->rootPassword)->assertOk();

        $this->postJson('/api/v1/admin/logout')->assertOk();

        $this->getJson('/api/v1/admin/me')->assertUnauthorized();
    }

    public function test_admin_can_change_own_password(): void
    {
        $this->login($this->rootPassword)->assertOk();

        $this->putJson('/api/v1/admin/password', [
            'current_password' => $this->rootPassword,
            'new_password' => 'password-baru-kuat',
            'new_password_confirmation' => 'password-baru-kuat',
        ])->assertOk();

        // logout lalu login dengan password baru
        $this->postJson('/api/v1/admin/logout');
        $this->login('password-baru-kuat')->assertOk();
    }

    public function test_password_change_requires_current_password(): void
    {
        $this->login($this->rootPassword)->assertOk();

        $this->putJson('/api/v1/admin/password', [
            'current_password' => 'salah',
            'new_password' => 'password-baru-kuat',
            'new_password_confirmation' => 'password-baru-kuat',
        ])->assertStatus(422);
    }

    public function test_password_change_requires_confirmation_and_min_length(): void
    {
        $this->login($this->rootPassword)->assertOk();

        $this->putJson('/api/v1/admin/password', [
            'current_password' => $this->rootPassword,
            'new_password' => 'pendek',
            'new_password_confirmation' => 'pendek',
        ])->assertUnprocessable();
    }

    public function test_login_response_never_contains_password_hash(): void
    {
        $body = (string) $this->login($this->rootPassword)->assertOk()->getContent();
        $this->assertStringNotContainsString('password', $body);
        $this->assertStringNotContainsString('$2y$', $body);
    }

    public function test_login_returns_single_use_enter_token(): void
    {
        $res = $this->login($this->rootPassword)->assertOk();
        $url = $res->json('data.enter_url');
        $this->assertStringContainsString('/admin/enter?token=', $url);

        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $token = $q['token'];

        // Konsumsi lewat jalur browser → redirect /admin + sesi aktif
        $this->get('/admin/enter?token='.$token)->assertRedirect('/admin');
        $this->getJson('/api/v1/admin/me')->assertOk();

        // Token sekali pakai — pemakaian kedua gagal
        $this->postJson('/api/v1/admin/logout');
        $this->get('/admin/enter?token='.$token)->assertRedirect('/admin?enter=failed');
    }

    public function test_enter_rejects_unknown_token_without_login(): void
    {
        $this->get('/admin/enter?token='.str_repeat('a', 32))
            ->assertRedirect('/admin?enter=failed');

        $this->getJson('/api/v1/admin/me')->assertUnauthorized();
    }
}

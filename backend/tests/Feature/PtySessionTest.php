<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class PtySessionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Config::set('pty.session_ttl', 600);
        Config::set('pty.max_sessions', 20);
        Cache::flush();
        RateLimiter::clear('pty-session:127.0.0.1');
    }

    public function test_store_returns_random_ticket_and_verify_accepts_it(): void
    {
        $res = $this->postJson('/api/v1/pty/sessions', [])
            ->assertOk()
            ->assertJsonStructure(['data' => ['ticket', 'expires_in']]);

        $ticket = $res->json('data.ticket');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $ticket);

        $this->getJson("/api/v1/pty/verify/{$ticket}")
            ->assertOk()
            ->assertJson(['data' => ['ok' => true]]);
    }

    public function test_verify_rejects_unknown_or_malformed_ticket(): void
    {
        $this->getJson('/api/v1/pty/verify/'.str_repeat('a', 32))->assertNotFound();
        $this->getJson('/api/v1/pty/verify/xyz')->assertNotFound();
    }

    public function test_session_cap_blocks_new_tickets(): void
    {
        Config::set('pty.max_sessions', 2);

        $this->postJson('/api/v1/pty/sessions', [])->assertOk();
        $this->postJson('/api/v1/pty/sessions', [])->assertOk();
        $this->postJson('/api/v1/pty/sessions', [])->assertTooManyRequests();
    }

    public function test_expired_tickets_are_swept(): void
    {
        Cache::put('pty.tickets', [
            'a' => time() - 100,
            'b' => time() - 100,
        ], 600);

        $this->postJson('/api/v1/pty/sessions', [])->assertOk();
    }

    public function test_rate_limit_on_session_creation(): void
    {
        RateLimiter::clear('pty-session:127.0.0.1');
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/pty/sessions', [])->assertOk();
        }
        $this->postJson('/api/v1/pty/sessions', [])->assertTooManyRequests();
    }
}

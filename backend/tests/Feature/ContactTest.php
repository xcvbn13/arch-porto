<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ContactTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('contact:127.0.0.1');
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => '  Budi Santoso  ',
            'email' => '  BUDI@Example.COM ',
            'message' => '  Halo, saya tertarik berkolaborasi.  ',
        ], $overrides);
    }

    public function test_valid_contact_is_stored_and_email_normalized(): void
    {
        $this->postJson('/api/v1/contact', $this->payload())
            ->assertCreated()
            ->assertJsonStructure(['data' => ['message']]);

        $this->assertDatabaseHas('contact_messages', [
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'message' => 'Halo, saya tertarik berkolaborasi.',
        ]);
    }

    public function test_invalid_email_rejected_with_specific_message(): void
    {
        $this->postJson('/api/v1/contact', $this->payload(['email' => 'bukan-email']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'The email address must be valid.']);
    }

    public function test_missing_fields_rejected(): void
    {
        $this->postJson('/api/v1/contact', ['name' => 'x'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'message']);
    }

    public function test_too_long_fields_rejected(): void
    {
        $this->postJson('/api/v1/contact', $this->payload([
            'name' => str_repeat('a', 121),
            'message' => str_repeat('b', 5001),
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'message']);
    }

    public function test_rate_limit_blocks_after_three_messages(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/contact', $this->payload(['email' => "u{$i}@example.com"]))
                ->assertCreated();
        }

        $this->postJson('/api/v1/contact', $this->payload(['email' => 'u9@example.com']))
            ->assertTooManyRequests();
    }

    public function test_malformed_json_does_not_crash(): void
    {
        $response = $this->call(
            'POST',
            '/api/v1/contact',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
            '{ini bukan json',
        );

        $this->assertContains($response->status(), [400, 422]);
        $this->assertStringNotContainsString('stack', (string) $response->getContent());
    }

    public function test_success_response_does_not_echo_email_or_message(): void
    {
        $response = $this->postJson('/api/v1/contact', $this->payload())->assertCreated();
        $body = (string) $response->getContent();
        $this->assertStringNotContainsString('budi@example.com', $body);
        $this->assertStringNotContainsString('berkolaborasi', $body);
    }

    public function test_success_response_is_honest_about_email_integration(): void
    {
        $response = $this->postJson('/api/v1/contact', $this->payload())->assertCreated();
        $this->assertStringContainsString('integrasi email', strtolower((string) $response->getContent()));
    }
}

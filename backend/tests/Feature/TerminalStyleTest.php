<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TerminalStyleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function style(array $overrides = []): array
    {
        return array_merge([
            'background' => '#101820',
            'foreground' => '#e8e8e8',
            'accent' => '#4f8cff',
            'cursor' => '#ff6b6b',
            'font_size' => 16,
            'blink' => false,
            'font_family' => 'Fira Code',
            'font_weight' => 'bold',
            'letter_spacing' => 2,
            'line_height' => 1.2,
            'padding' => 12,
            'cursor_style' => 'bar',
            'selection_color' => '#335577',
            'opacity' => 0.85,
        ], $overrides);
    }

    public function test_public_style_returns_defaults_when_unset(): void
    {
        $this->getJson('/api/v1/terminal-style')
            ->assertOk()
            ->assertJson(['data' => [
                'background' => '#0c0f14',
                'font_family' => 'JetBrains Mono',
                'cursor_style' => 'block',
                'padding' => 8,
            ]]);
    }

    public function test_admin_can_update_style_and_public_reflects_it(): void
    {
        $admins = require base_path('database/seeders/data/admins.php');
        $this->postJson('/api/v1/admin/login', ['password' => $admins[0]['password']])->assertOk();

        $style = $this->style();
        $this->putJson('/api/v1/admin/terminal-style', $style)->assertOk();
        $this->getJson('/api/v1/terminal-style')->assertJson(['data' => $style]);
    }

    public function test_style_validation_rejects_bad_values(): void
    {
        $admins = require base_path('database/seeders/data/admins.php');
        $this->postJson('/api/v1/admin/login', ['password' => $admins[0]['password']])->assertOk();

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['background' => 'merah']))
            ->assertUnprocessable()->assertJsonValidationErrors(['background']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['font_size' => 40]))
            ->assertUnprocessable()->assertJsonValidationErrors(['font_size']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['letter_spacing' => 99]))
            ->assertUnprocessable()->assertJsonValidationErrors(['letter_spacing']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['line_height' => 3]))
            ->assertUnprocessable()->assertJsonValidationErrors(['line_height']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['padding' => 500]))
            ->assertUnprocessable()->assertJsonValidationErrors(['padding']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['cursor_style' => 'blink-block']))
            ->assertUnprocessable()->assertJsonValidationErrors(['cursor_style']);

        $this->putJson('/api/v1/admin/terminal-style', $this->style(['font_weight' => 'heavy']))
            ->assertUnprocessable()->assertJsonValidationErrors(['font_weight']);
    }

    public function test_style_update_requires_admin(): void
    {
        $this->putJson('/api/v1/admin/terminal-style', $this->style())->assertUnauthorized();
    }
}

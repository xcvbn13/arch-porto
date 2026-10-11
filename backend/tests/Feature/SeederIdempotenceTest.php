<?php

namespace Tests\Feature;

use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi: db:seed berulang (entrypoint) TIDAK boleh menimpa data yang
 * diubah pemilik lewat panel admin / DBeaver.
 */
class SeederIdempotenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_reseeding_does_not_overwrite_profile_skills_projects(): void
    {
        $this->seed();

        // Ubah data seperti yang dilakukan pemilik lewat panel
        Profile::query()->first()->update([
            'name' => 'Nama Pemilik Asli',
            'bio' => 'Bio yang diketik pemilik.',
            'github_url' => 'https://github.com/pemilik',
        ]);
        Skill::query()->where('name', 'React')->update(['level' => 'expert-pemilik']);
        Project::query()->first()->update([
            'title' => 'Proyek Pemilik',
            'description' => 'Deskripsi asli pemilik.',
        ]);

        // Seed ulang (persis seperti entrypoint pada restart)
        $this->seed();

        $this->assertSame('Nama Pemilik Asli', Profile::query()->first()->name);
        $this->assertSame('Bio yang diketik pemilik.', Profile::query()->first()->bio);
        $this->assertSame('https://github.com/pemilik', Profile::query()->first()->github_url);
        $this->assertSame('expert-pemilik', Skill::query()->where('name', 'React')->value('level'));
        $this->assertSame('Proyek Pemilik', Project::query()->first()->title);
        $this->assertSame('Deskripsi asli pemilik.', Project::query()->first()->description);
    }

    public function test_reseeding_does_not_reset_admin_password(): void
    {
        $this->seed();

        $admins = require base_path('database/seeders/data/admins.php');
        $root = \App\Models\User::query()->where('email', $admins[0]['email'])->first();

        // Ubah password seperti lewat panel (cast 'hashed' otomatis me-hash)
        $root->update(['password_hash' => 'password-baru-dari-panel']);
        $before = $root->fresh()->password_hash;

        $this->seed();

        $this->assertSame($before, $root->fresh()->password_hash);
    }
}

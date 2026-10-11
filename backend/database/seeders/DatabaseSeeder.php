<?php

namespace Database\Seeders;

use App\Models\Certification;
use App\Models\Education;
use App\Models\Experience;
use App\Models\FetchEntry;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Publication;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seeder FIRST-RUN-ONLY: setiap entitas hanya di-seed bila tabelnya
     * kosong, sehingga data yang diubah dari panel admin/DBeaver TIDAK
     * pernah ditimpa saat entrypoint menjalankan db:seed pada restart.
     * Akun admin memakai firstOrCreate (password panel tidak di-reset).
     */
    public function run(): void
    {
        $data = require __DIR__.'/data/portfolio.php';

        // Akun root (admin) — firstOrCreate: tidak menimpa password yang
        // diubah lewat panel.
        $admins = require __DIR__.'/data/admins.php';
        foreach ($admins as $admin) {
            User::query()->firstOrCreate(
                ['email' => $admin['email']],
                [
                    'name' => $admin['name'],
                    'password_hash' => Hash::make($admin['password']),
                    'is_admin' => true,
                ],
            );
        }

        if (Profile::query()->count() === 0) {
            Profile::query()->create(['id' => 1] + $data['profile']);
        }

        if (Skill::query()->count() === 0) {
            foreach ($data['skills'] as $i => $skill) {
                Skill::query()->create([
                    'category' => $skill['category'],
                    'name' => $skill['name'],
                    'level' => $skill['level'] ?? null,
                    'description' => $skill['description'] ?? null,
                    'sort_order' => $i,
                ]);
            }
        }

        if (Project::query()->count() === 0) {
            foreach ($data['projects'] as $project) {
                Project::query()->create($project);
            }
        }

        if (Experience::query()->count() === 0) {
            foreach ($data['experience'] as $row) {
                Experience::query()->create($row);
            }
        }

        if (Education::query()->count() === 0) {
            foreach ($data['education'] as $row) {
                Education::query()->create($row);
            }
        }

        if (Certification::query()->count() === 0) {
            foreach ($data['certifications'] as $row) {
                Certification::query()->create($row);
            }
        }

        if (Publication::query()->count() === 0) {
            foreach ($data['publications'] as $row) {
                Publication::query()->create($row);
            }
        }

        if (FetchEntry::query()->count() === 0) {
            foreach ($data['fetch'] as $i => $row) {
                FetchEntry::query()->create([
                    'label' => $row['label'],
                    'value' => $row['value'],
                    'sort_order' => $i,
                ]);
            }
        }
    }
}

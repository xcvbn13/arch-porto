<?php

/**
 * ============================================================================
 * SATU-SATUNYA sumber data portfolio untuk seeder.
 *
 * Semua nilai di bawah adalah PLACEHOLDER yang jelas — ganti dengan data
 * asli Anda, lalu jalankan:  php artisan db:seed --force
 *
 * Tidak ada riwayat kerja, sertifikasi, publikasi, URL, atau metrik yang
 * dikarang: array yang kosong sengaja dikosongkan. Hanya proyek nyata yang
 * boleh ditampilkan.
 * ============================================================================
 */

return [

    'profile' => [
        'name' => 'Imam',                       // placeholder — ganti nama Anda
        'role' => 'Fullstack Developer',
        'tagline' => 'Membangun aplikasi web end-to-end dengan terminal sebagai antarmuka.',
        'bio' => <<<'TXT'
Saya seorang Fullstack Developer dengan minat pada aplikasi web, Linux, dan otomasi.
Portfolio ini sendiri adalah contoh karya: terminal interaktif bergaya Arch Linux
yang dibangun dengan React + xterm.js di frontend dan Laravel + PostgreSQL di backend.

Ganti bio ini dengan pengenalan profesional Anda yang sebenarnya.
TXT,
        'email' => null,                        // placeholder — isi alamat asli
        'github_url' => null,                   // placeholder — isi profil asli
        'linkedin_url' => null,                 // placeholder — isi profil asli
        'resume_url' => null,                   // placeholder — URL CV asli
        'website_url' => null,                  // placeholder — situs pribadi
        'avatar_url' => null,                   // placeholder — URL foto profil (tampil di 'about')
    ],

    // Keahlian teknis. Sertakan hanya yang benar-benar dikuasai.
    'skills' => [
        ['category' => 'frontend', 'name' => 'React', 'level' => 'advanced'],
        ['category' => 'frontend', 'name' => 'TypeScript', 'level' => 'advanced'],
        ['category' => 'frontend', 'name' => 'Vite', 'level' => 'advanced'],
        ['category' => 'frontend', 'name' => 'Tailwind CSS', 'level' => 'intermediate'],
        ['category' => 'frontend', 'name' => 'xterm.js', 'level' => 'intermediate'],
        ['category' => 'backend', 'name' => 'Laravel', 'level' => 'advanced'],
        ['category' => 'backend', 'name' => 'PHP', 'level' => 'advanced'],
        ['category' => 'backend', 'name' => 'REST API', 'level' => 'advanced'],
        ['category' => 'backend', 'name' => 'Python', 'level' => 'intermediate'],
        ['category' => 'database', 'name' => 'PostgreSQL', 'level' => 'intermediate'],
        ['category' => 'devops', 'name' => 'Docker', 'level' => 'advanced'],
        ['category' => 'devops', 'name' => 'Nginx', 'level' => 'intermediate'],
        ['category' => 'linux', 'name' => 'Arch Linux', 'level' => 'intermediate'],
        ['category' => 'linux', 'name' => 'Shell Scripting', 'level' => 'intermediate'],
    ],

    // Hanya proyek yang benar-benar dimiliki. Contoh di bawah adalah proyek
    // portfolio ini sendiri (nyata). Tambahkan proyek lain milik Anda.
    'projects' => [
        [
            'title' => 'Portfolio Terminal Arch',
            'summary' => 'Website portfolio interaktif dengan antarmuka terminal bergaya Arch Linux (proyek ini).',
            'description' => <<<'TXT'
Aplikasi portfolio yang dapat dijelajahi dengan mengetik perintah pada terminal
interaktif. Frontend React + xterm.js dengan command parser allowlist, backend
Laravel + PostgreSQL, dan sandbox Arch Linux opsional yang read-only dan
di-allowlist ketat untuk output command asli.
TXT,
            'problem' => 'Portfolio konvensional pasif; pengunjung hanya scroll. Terminal membuat eksplorasi profil menjadi aktif dan berkesan.',
            'contribution' => 'Membangun end-to-end: parser command, registry allowlist, REST API, containerization, hardening sandbox, dan dokumentasi.',
            'architecture' => <<<'TXT'
xterm.js (emulator terminal) -> parser allowlist -> command registry ->
handler lokal (simulasi) atau REST API -> Laravel 12 -> PostgreSQL.
Command Arch bergaya dual-mode: simulasi statis atau eksekusi nyata di
container Arch Linux non-root, read-only, tanpa shell arbitrer.
TXT,
            'stack' => ['react', 'typescript', 'xterm.js', 'vite', 'laravel', 'postgresql', 'docker', 'nginx'],
            'repo_url' => null,                 // placeholder — isi URL repo asli
            'demo_url' => null,                 // placeholder — isi URL demo asli
            'metrics' => null,                  // tanpa metrik karangan
            'screenshots' => null,              // placeholder — ["https://.../1.png", ...]
            'year' => '2026',
            'featured' => true,
            'sort_order' => 0,
        ],
    ],

    // Kosongkan sampai ada data asli yang dikonfirmasi pemilik.
    'experience' => [],
    'education' => [],
    'certifications' => [],
    'publications' => [],

    // Baris default blok fetch (fastfetch/neofetch/banner) — disimpan ke
    // tabel fetch_entries HANYA saat tabel kosong (edit/hapus dari panel
    // admin tidak ditimpa oleh seeder berikutnya).
    'fetch' => [
        ['label' => 'Name', 'value' => 'Imam Yabunaiya Ramadhani'],
        ['label' => 'Role', 'value' => 'Fullstack Developer'],
        ['label' => 'Focus', 'value' => 'Backend Engineering'],
        ['label' => 'Experience', 'value' => '4+ years'],
        ['label' => 'Primary', 'value' => 'PHP / Laravel / Python'],
        ['label' => 'API', 'value' => 'RESTful API & Integrations'],
        ['label' => 'Systems', 'value' => 'Redis / Queues / Docker'],
        ['label' => 'AI / ML', 'value' => 'Python / NLP / Computer Vision'],
        ['label' => 'Education', 'value' => 'B.Informatics'],
        ['label' => 'University', 'value' => 'Telkom University'],
        ['label' => 'Status', 'value' => 'Building reliable software'],
    ],
];

<?php

/**
 * Daftar akun ROOT (admin) yang dibuat saat seeder dijalankan.
 * `sudo su` di terminal login sebagai akun PERTAMA di daftar ini.
 *
 * Password di bawah adalah PLACEHOLDER — ganti lewat environment
 * (ROOT_PASSWORD / ADMIN_PASSWORD) atau lewat panel admin setelah login.
 * Password yang diubah lewat panel TIDAK ditimpa seeder (firstOrCreate).
 */

return [
    [
        'name' => 'Root',
        'email' => 'root@imam-portfolio.local',
        'password' => env('ROOT_PASSWORD', 'change-me-root-password'),
    ],
    [
        'name' => 'Administrator',
        'email' => 'admin@imam-portfolio.local',
        'password' => env('ADMIN_PASSWORD', 'change-me-admin-password'),
    ],
];

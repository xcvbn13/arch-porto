<?php

/**
 * Konfigurasi PTY shell (bash read-only di container Arch).
 * Opsional seperti sandbox — default NONAKTIF.
 */
return [
    'enabled' => (bool) env('ARCH_PTY_ENABLED', false),

    /** TTL tiket sesi (detik) — idle 5 menit, cukup untuk kunjungan wajar. */
    'session_ttl' => (int) env('PTY_SESSION_TTL', 300),

    /** Batas sesi PTY aktif global — naikkan sesuai trafik produksi. */
    'max_sessions' => (int) env('PTY_MAX_SESSIONS', 100),
];

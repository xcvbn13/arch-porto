<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Tiket sesi PTY (shell Arch read-only).
 * Dibuat di sini (rate limited + cap + TTL), diverifikasi oleh bridge PTY
 * melalui jaringan internal. Tanpa tiket, bridge menolak koneksi.
 */
class PtySessionController extends Controller
{
    private const KEY = 'pty.tickets';

    private function ttl(): int
    {
        return (int) config('pty.session_ttl', 600);
    }

    private function maxSessions(): int
    {
        return (int) config('pty.max_sessions', 20);
    }

    public function store(Request $request): JsonResponse
    {
        $ttl = $this->ttl();
        $now = time();

        /** @var array<string, int> $tickets */
        $tickets = Cache::get(self::KEY, []);
        // Bersihkan kedaluwarsa
        $tickets = array_filter($tickets, fn (int $exp) => $exp > $now);

        if (count($tickets) >= $this->maxSessions()) {
            return response()->json(['message' => 'too_many_sessions'], 429);
        }

        $ticket = bin2hex(random_bytes(16)); // 128-bit acak
        $tickets[$ticket] = $now + $ttl;
        Cache::put(self::KEY, $tickets, $ttl);

        return response()->json([
            'data' => [
                'ticket' => $ticket,
                'expires_in' => $ttl,
            ],
        ]);
    }

    public function verify(string $ticket): JsonResponse
    {
        $now = time();

        /** @var array<string, int> $tickets */
        $tickets = Cache::get(self::KEY, []);
        $tickets = array_filter($tickets, fn (int $exp) => $exp > $now);
        Cache::put(self::KEY, $tickets, $this->ttl());

        if (! array_key_exists($ticket, $tickets)) {
            return response()->json(['message' => 'invalid_ticket'], 404);
        }

        return response()->json(['data' => ['ok' => true]]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactRequest;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ContactController extends Controller
{
    /**
     * Simpan pesan pengunjung. Email TIDAK dikirim di sini: integrasi email
     * belum dikonfigurasi (dokumentasikan di README). Pesan hanya disimpan
     * dan dilaporkan sukses secara jujur.
     */
    public function store(ContactRequest $request): JsonResponse
    {
        $data = $request->validated();

        $message = ContactMessage::query()->create([
            'name' => $data['name'],
            'email' => $data['email'], // sudah dinormalisasi di ContactRequest
            'message' => $data['message'],
        ]);

        // Log minimal tanpa isi pesan (privasi pengunjung).
        Log::channel('contact')->info('Contact message stored.', ['id' => $message->id]);

        return response()->json([
            'data' => [
                'message' => 'Pesan Anda berhasil direkam. Integrasi email belum dikonfigurasi — pemilik membaca pesan dari database.',
            ],
        ], 201);
    }
}

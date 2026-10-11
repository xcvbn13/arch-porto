<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Upload/hapus file sertifikat (PDF/gambar). File disimpan di
 * storage/app/avatars/certificates dan disajikan via
 * /api/v1/files/certificates/{file}; certifications.file_url menyimpan path.
 */
class CertificationFileController extends Controller
{
    private const DIR = 'certificates';
    private const PREFIX = '/api/v1/files/certificates/';

    public function store(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $cert = Certification::query()->find($id);
        if (! $cert) {
            return response()->json(['message' => 'Certification not found.'], 404);
        }

        $file = $request->file('file');
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        Storage::disk('avatars')->putFileAs(self::DIR, $file, $filename);

        $this->deleteOld($cert);
        $cert->update(['file_url' => self::PREFIX.$filename]);

        Log::channel('admin')->info('Certification file uploaded.', [
            'user_id' => (string) $request->user()?->id, 'certification' => $id, 'filename' => $filename,
        ]);

        return response()->json(['data' => ['file_url' => $cert->fresh()->file_url]], 201);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $cert = Certification::query()->find($id);
        if (! $cert) {
            return response()->json(['message' => 'Certification not found.'], 404);
        }

        $this->deleteOld($cert);
        $cert->update(['file_url' => null]);

        Log::channel('admin')->info('Certification file deleted.', [
            'user_id' => (string) $request->user()?->id, 'certification' => $id,
        ]);

        return response()->json(['data' => ['message' => 'Deleted.']]);
    }

    private function deleteOld(?Certification $cert): void
    {
        if (! $cert?->file_url || ! str_starts_with($cert->file_url, self::PREFIX)) {
            return;
        }
        $name = substr($cert->file_url, strlen(self::PREFIX));
        if (preg_match('/^[A-Za-z0-9._-]{1,120}$/', $name)) {
            Storage::disk('avatars')->delete(self::DIR.'/'.$name);
        }
    }
}

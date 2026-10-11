<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ContactMessagesController extends Controller
{
    public function index(): JsonResponse
    {
        $page = ContactMessage::query()->orderByDesc('id')->paginate(20);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $message = ContactMessage::query()->find($id);

        if (! $message) {
            return response()->json(['message' => 'Message not found.'], 404);
        }

        $message->delete();

        Log::channel('admin')->info('Admin deleted contact message.', [
            'user_id' => (string) $request->user()?->id, 'id' => $id,
        ]);

        return response()->json(['data' => ['message' => 'Deleted.']]);
    }
}

<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $user = Auth::guard('web')->user();

        $data = $request->validate([
            'current_password' => ['required', 'string', 'max:512'],
            'new_password' => ['required', 'string', Password::min(8), 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password_hash)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password_hash' => $data['new_password']]);

        Log::channel('admin')->info('Admin password changed.', ['user_id' => $user->id]);

        return response()->json(['data' => ['message' => 'Password changed.']]);
    }
}

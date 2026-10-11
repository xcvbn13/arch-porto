<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class ContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // endpoint publik — keamanan lewat validasi + rate limit
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'message' => ['required', 'string', 'max:5000'],
        ];
    }

    /** Normalisasi: trim semua, email lowercase. */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => Str::of($this->input('name'))->trim()->toString(),
            'email' => Str::of($this->input('email'))->trim()->lower()->toString(),
            'message' => Str::of($this->input('message'))->trim()->toString(),
        ]);
    }

    public function messages(): array
    {
        return [
            'email.email' => 'The email address must be valid.',
        ];
    }
}

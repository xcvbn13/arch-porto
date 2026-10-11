<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CertificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'issuer' => $this->issuer,
            'year' => $this->year,
            'credential_url' => $this->credential_url,
            'file_url' => $this->file_url
                ? (str_starts_with($this->file_url, '/api/v1/')
                    ? rtrim((string) config('app.url'), '/').$this->file_url
                    : $this->file_url)
                : null,
        ];
    }
}

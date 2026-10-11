<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExperienceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company' => $this->company,
            'role' => $this->role,
            'period_start' => $this->period_start,
            'period_end' => $this->period_end,
            'summary' => $this->summary,
            'highlights' => $this->highlights ?? [],
        ];
    }
}

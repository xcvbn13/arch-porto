<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EducationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'institution' => $this->institution,
            'degree' => $this->degree,
            'field' => $this->field,
            'period_start' => $this->period_start,
            'period_end' => $this->period_end,
            'summary' => $this->summary,
        ];
    }
}

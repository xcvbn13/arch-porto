<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'summary' => $this->summary,
            'description' => $this->description,
            'problem' => $this->problem,
            'contribution' => $this->contribution,
            'architecture' => $this->architecture,
            'stack' => $this->stack ?? [],
            'repo_url' => $this->repo_url,
            'demo_url' => $this->demo_url,
            'metrics' => $this->metrics,
            'screenshots' => $this->screenshots ?? [],
            'year' => $this->year,
        ];
    }
}

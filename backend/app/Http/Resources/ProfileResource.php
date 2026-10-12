<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->name,
            'role' => $this->role,
            'tagline' => $this->tagline,
            'bio' => $this->bio,
            'email' => $this->email,
            'github_url' => $this->github_url,
            'linkedin_url' => $this->linkedin_url,
            'resume_url' => $this->resume_url,
            'website_url' => $this->website_url,
            'avatar_url' => $this->avatar_url,
            'about_layout' => array_merge(
                \App\Http\Controllers\Api\ProfileController::ABOUT_LAYOUT_DEFAULTS,
                is_array($this->about_layout) ? $this->about_layout : [],
            ),
        ];
    }
}

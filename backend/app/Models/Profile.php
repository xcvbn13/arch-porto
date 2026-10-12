<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $fillable = [
        'name', 'role', 'tagline', 'bio', 'email',
        'github_url', 'linkedin_url', 'resume_url', 'website_url',
        'avatar_url', 'fetch_logo_url', 'terminal_style', 'fetch_layout', 'about_layout', 'projects_layout',
    ];

    protected function casts(): array
    {
        return [
            'terminal_style' => 'array',
            'fetch_layout' => 'array',
            'about_layout' => 'array',
            'projects_layout' => 'array',
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'title', 'summary', 'description', 'problem', 'contribution',
        'architecture', 'stack', 'repo_url', 'demo_url', 'metrics',
        'screenshots', 'year', 'featured', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'stack' => 'array',
            'metrics' => 'array',
            'screenshots' => 'array',
            'featured' => 'boolean',
        ];
    }
}

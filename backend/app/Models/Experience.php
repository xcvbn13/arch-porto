<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Experience extends Model
{
    protected $fillable = [
        'company', 'role', 'period_start', 'period_end', 'summary',
        'highlights', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['highlights' => 'array'];
    }
}

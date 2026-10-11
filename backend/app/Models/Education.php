<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Education extends Model
{
    protected $fillable = [
        'institution', 'degree', 'field', 'period_start', 'period_end',
        'summary', 'sort_order',
    ];
}

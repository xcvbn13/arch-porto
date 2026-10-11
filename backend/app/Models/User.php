<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $fillable = ['name', 'email', 'password_hash', 'is_admin'];

    protected $hidden = ['password_hash', 'remember_token'];

    protected function casts(): array
    {
        return [
            'is_admin' => 'boolean',
            'password_hash' => 'hashed',
        ];
    }

    /** Kolom password mengikuti config/auth.php (default: password_hash). */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }
}

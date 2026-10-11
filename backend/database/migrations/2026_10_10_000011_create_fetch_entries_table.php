<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fetch_entries', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('value');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->string('fetch_logo_url')->nullable()->after('avatar_url');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fetch_entries');

        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn('fetch_logo_url');
        });
    }
};

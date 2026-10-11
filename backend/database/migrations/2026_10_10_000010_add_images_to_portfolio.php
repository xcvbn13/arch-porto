<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->string('avatar_url')->nullable()->after('website_url');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->json('screenshots')->nullable()->after('metrics');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn('avatar_url');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('screenshots');
        });
    }
};

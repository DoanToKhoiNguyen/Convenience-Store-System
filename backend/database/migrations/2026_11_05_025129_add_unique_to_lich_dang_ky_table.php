<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lich_dang_ky', function (Blueprint $table) {
            $table->unique(['MaTaiKhoan', 'NgayDangKy', 'MaCa'], 'lich_dang_ky_unique');
        });
    }

    public function down(): void
    {
        Schema::table('lich_dang_ky', function (Blueprint $table) {
            $table->dropUnique('lich_dang_ky_unique');
        });
    }
};

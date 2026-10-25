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
        Schema::create('tai__khoan', function (Blueprint $table) {
            $table->id('MaTaiKhoan');
            $table->string('TenDangNhap')->unique();
            $table->string('MatKhau');
            $table->string('HoTen');
            $table->string('Email')->unique();
            $table->string('SoDienThoai')->nullable();
            $table->boolean('TrangThai')->default(true);
            $table->string('MaVaiTro');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tai__khoan');
    }
};

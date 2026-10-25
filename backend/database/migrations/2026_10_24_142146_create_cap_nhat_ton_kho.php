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
        Schema::create('cap_nhat_ton_kho', function (Blueprint $table) {
            $table->id('MaCapNhat');
            $table->dateTime('ThoiGianCapNhat')->default(now());
            $table->integer('SoLuongMoi');
            $table->integer('SoLuongHienTai');
            $table->string('LyDoCapNhat');
            $table->foreignId('MaTaiKhoan')->constrained('tai__khoan', 'MaTaiKhoan')->onDelete('cascade');
            $table->foreignId('MaSanPham')->constrained('san_pham', 'MaSanPham')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cap_nhat_ton_kho');
    }
};

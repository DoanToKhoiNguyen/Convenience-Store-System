<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lo_hang_da_loai', function (Blueprint $table) {
            $table->id('MaLoai');
            // Không khóa ngoại tới lô/sản phẩm: nhật ký phải giữ nguyên kể cả khi lô bị dọn sau này.
            $table->unsignedBigInteger('MaLoHang')->index();
            $table->unsignedBigInteger('MaSanPham')->index();
            $table->string('TenSanPham');
            $table->string('MaLo', 30);
            $table->date('HanSuDung')->nullable();
            $table->integer('SoLuongLoai');
            $table->dateTime('ThoiGianLoai');
            $table->foreignId('MaTaiKhoan')->nullable()->constrained('tai__khoan', 'MaTaiKhoan')->nullOnDelete();
            $table->string('LyDo')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lo_hang_da_loai');
    }
};

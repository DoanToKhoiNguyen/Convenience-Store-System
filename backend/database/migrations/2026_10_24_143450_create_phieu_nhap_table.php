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
        Schema::create('phieu_nhap', function (Blueprint $table) {
            $table->id('MaPhieuNhap');
            $table->dateTime('NgayLap')->default(now());
            $table->integer('TrangThai');
            $table->decimal('TongGiaTri', 12, 2)->default(0);
        
            $table->foreignId('MaTaiKhoan')->constrained('tai__khoan', 'MaTaiKhoan')->onDelete('cascade');
            $table->foreignId('MaNhaCungCap')->constrained('nha_cung_cap', 'MaNhaCungCap')->onDelete('cascade');
        
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('phieu_nhap');
    }
};

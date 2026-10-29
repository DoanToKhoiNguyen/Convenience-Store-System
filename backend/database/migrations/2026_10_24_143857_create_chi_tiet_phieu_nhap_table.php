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
        Schema::create('chi_tiet_phieu_nhap', function (Blueprint $table) {
            $table->id('MaChiTietPhieuNhap');
            $table->string('TenSanPham');
            $table->integer('SoLuong');
            $table->decimal('DonGia', 12, 2);
            $table->decimal('TongGia', 12, 2);
            $table->date('NgaySanXuat')->nullable();

            $table->foreignId('MaPhieuNhap')->constrained('phieu_nhap', 'MaPhieuNhap')->onDelete('cascade');
            $table->foreignId('MaSanPham')->constrained('san_pham', 'MaSanPham')->onDelete('cascade');
        
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chi_tiet_phieu_nhap');
    }
};

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
        Schema::create('chi_tiet_hoa_don', function (Blueprint $table) {
            $table->id('MaChiTietHoaDon');
            $table->string('TenSanPham');
            $table->integer('SoLuong');
            $table->decimal('ThanhTien', 12, 2);
        
            $table->foreignId('MaHoaDon')->constrained('hoa_don', 'MaHoaDon')->onDelete('cascade');
            $table->foreignId('MaSanPham')->constrained('san_pham', 'MaSanPham')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chi_tiet_hoa_don');
    }
};

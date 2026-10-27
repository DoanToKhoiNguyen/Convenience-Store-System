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
        Schema::create('san_pham', function (Blueprint $table){
        $table->id('MaSanPham');
        $table->string('TenSanPham')->unique();
        $table->decimal('DonGiaBan', 12, 2);
        $table->integer('TonKhoToiThieu');
        $table->integer('TonKhoToiDa');
        $table->integer('CanhBaoHSD');
        $table->integer('SoLuongHienTai');
        $table->string('TenThuongHieu');
        $table->string('MoTa');
        $table->string('ThanhPhan');
        $table->string('LoaiSanPham');
        $table->foreignId('MaNhaCungCap')->constrained('nha_cung_cap', 'MaNhaCungCap')->onDelete('cascade');
        $table->timestamps();
        });
    }
// TenThuongHieu, MoTa, ThanhPhan, LoaiSanPham)

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};

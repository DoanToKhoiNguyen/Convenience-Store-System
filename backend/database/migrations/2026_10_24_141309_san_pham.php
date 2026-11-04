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
        $table->decimal('DonGiaBan', 12, 2)->nullable();
        $table->decimal('DonGiaNhap', 12, 2)->nullable();
        $table->integer('TonKhoToiThieu')->nullable();
        $table->integer('TonKhoToiDa')->nullable();
        $table->integer('CanhBaoHSD')->nullable();
        $table->integer('SoLuongHienTai');
        $table->string('TenThuongHieu')->nullable();
        $table->string('MoTa')->nullable();
        $table->boolean('TrangThai')->nullable();
        $table->string('ThanhPhan')->nullable();
        $table->string('LoaiSanPham')->nullable();
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
        Schema::table('san_pham', function (Blueprint $table) {
            $table->dropColumn('TrangThai');
        });
    }
};

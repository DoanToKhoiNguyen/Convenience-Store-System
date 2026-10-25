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
        Schema::create('hoa_don', function (Blueprint $table) {
            $table->id('MaHoaDon');
            $table->dateTime('NgayLap')->default(now());
            $table->decimal('TongTien', 12, 2);
            $table->string('MaGiaoDich')->nullable();
            $table->string('TenGiaoDich')->nullable();
            $table->boolean('TrangThaiHoaDon')->default('true');
            $table->decimal('TienGiamGia', 12, 2)->default(0);
        
            $table->foreignId('MaTaiKhoan')->constrained('tai__khoan', 'MaTaiKhoan')->onDelete('cascade');
            $table->foreignId('MaKhuyenMai')->nullable()->constrained('khuyen_mai', 'MaKhuyenMai')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hoa_don');
    }
};

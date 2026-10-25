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
        Schema::create('lich_dang_ky', function (Blueprint $table) {
            $table->id('MaDangKy');
            $table->date('NgayDangKy');
            $table->integer('TrangThai');
        
            $table->foreignId('MaTaiKhoan')->constrained('tai__khoan', 'MaTaiKhoan')->onDelete('cascade');
            $table->foreignId('MaCa')->constrained('ca_lam_viec', 'MaCa')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lich_dang_ky');
    }
};

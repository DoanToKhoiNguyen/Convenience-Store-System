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
        Schema::create('tai_khoan_vai_tro', function (Blueprint $table) {
            $table->id();
            $table->foreignId('MaTaiKhoan')->constrained('tai__khoan', 'MaTaiKhoan')->onDelete('cascade');
            $table->foreignId('MaVaiTro')->constrained('vai_tro', 'MaVaiTro')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tai_khoan_vai_tro');
    }
};

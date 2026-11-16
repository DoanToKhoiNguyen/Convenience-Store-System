<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nha_cung_cap_danh_muc', function (Blueprint $table) {
            $table->foreignId('MaNhaCungCap')->constrained('nha_cung_cap', 'MaNhaCungCap')->cascadeOnDelete();
            $table->foreignId('MaDanhMuc')->constrained('danh_muc', 'MaDanhMuc')->cascadeOnDelete();
            $table->primary(['MaNhaCungCap', 'MaDanhMuc']);
        });

        // Dữ liệu cũ: nhà cung cấp nào đang có sản phẩm thuộc danh mục nào thì coi là cung cấp danh mục đó
        DB::statement('
            INSERT INTO nha_cung_cap_danh_muc ("MaNhaCungCap", "MaDanhMuc")
            SELECT DISTINCT "MaNhaCungCap", "MaDanhMuc"
            FROM san_pham
            WHERE "MaNhaCungCap" IS NOT NULL AND "MaDanhMuc" IS NOT NULL
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('nha_cung_cap_danh_muc');
    }
};
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('chi_tiet_hoa_don', function (Blueprint $table) {
            $table->decimal('GiaVon', 12, 2)->default(0); // giá vốn trên 1 đơn vị, chụp lại lúc bán
        });

        // Hóa đơn cũ: lấy giá nhập hiện tại làm giá vốn
        DB::statement('
            UPDATE chi_tiet_hoa_don
            SET "GiaVon" = COALESCE(sp."DonGiaNhap", 0)
            FROM san_pham sp
            WHERE sp."MaSanPham" = chi_tiet_hoa_don."MaSanPham"
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chi_tiet_hoa_don', function (Blueprint $table) {
            $table->dropColumn('GiaVon');
        });
    }
};

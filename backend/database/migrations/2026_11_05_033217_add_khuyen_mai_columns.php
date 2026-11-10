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
        Schema::table('khuyen_mai', function (Blueprint $table) {
            $table->string('LoaiGiam', 20)->default('phan_tram'); // phan_tram | so_tien
            $table->decimal('GiamToiDa', 12, 2)->nullable();      // chỉ dùng cho loại phần trăm
            $table->boolean('TrangThai')->default(true);
        });

        Schema::table('hoa_don', function (Blueprint $table) {
            $table->decimal('TongTienHang', 12, 2)->default(0);   // tiền hàng trước giảm
        });

        // Hóa đơn cũ chưa có giảm giá: tiền hàng = tổng tiền
        DB::table('hoa_don')->update(['TongTienHang' => DB::raw('"TongTien"')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('khuyen_mai', function (Blueprint $table) {
            $table->dropColumn(['LoaiGiam', 'GiamToiDa', 'TrangThai']);
        });
        Schema::table('hoa_don', function (Blueprint $table) {
            $table->dropColumn('TongTienHang');
        });
    }
};

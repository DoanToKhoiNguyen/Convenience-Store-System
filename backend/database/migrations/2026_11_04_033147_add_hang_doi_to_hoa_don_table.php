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
        Schema::table('hoa_don', function (Blueprint $table) {
            $table->boolean('DaGiuHang')->default(false);   // đã trừ kho để giữ hàng
            $table->dateTime('HanThanhToan')->nullable();   // hạn thanh toán (khi ở hàng đợi)
            $table->boolean('DaHuy')->default(false);
            $table->string('LyDoHuy')->nullable();
            $table->dateTime('NgayThanhToan')->nullable();
        });

        DB::table('hoa_don')
            ->where('TrangThaiHoaDon', true)
            ->whereNull('NgayThanhToan')
            ->update(['NgayThanhToan' => DB::raw('"NgayLap"')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hoa_don', function (Blueprint $table) {
            $table->dropColumn(['DaGiuHang', 'HanThanhToan', 'DaHuy', 'LyDoHuy', 'NgayThanhToan']);
        });
    }
};

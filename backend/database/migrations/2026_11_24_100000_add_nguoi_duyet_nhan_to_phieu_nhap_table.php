<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('phieu_nhap', function (Blueprint $table) {
            $table->foreignId('MaTaiKhoanDuyet')->nullable()->after('MaTaiKhoan')
                ->constrained('tai__khoan', 'MaTaiKhoan')->nullOnDelete();
            $table->dateTime('NgayDuyet')->nullable()->after('MaTaiKhoanDuyet');
            $table->foreignId('MaTaiKhoanNhan')->nullable()->after('NgayDuyet')
                ->constrained('tai__khoan', 'MaTaiKhoan')->nullOnDelete();
            $table->dateTime('NgayNhan')->nullable()->after('MaTaiKhoanNhan');
        });

        // Phiếu đã nhận từ trước chưa lưu người nhận: suy ngày nhận từ lô hàng,
        // người nhận từ nhật ký tồn kho do chính lần nhận hàng đó ghi lại.
        DB::table('phieu_nhap')->where('TrangThai', 4)->whereNull('NgayNhan')->update([
            'NgayNhan' => DB::raw(
                '(SELECT MAX("NgayNhap") FROM lo_hang WHERE lo_hang."MaPhieuNhap" = phieu_nhap."MaPhieuNhap")'
            ),
        ]);

        $maPhieus = DB::table('phieu_nhap')->where('TrangThai', 4)->whereNull('MaTaiKhoanNhan')->pluck('MaPhieuNhap');
        foreach ($maPhieus as $ma) {
            $maTaiKhoan = DB::table('cap_nhat_ton_kho')
                ->where('LyDoCapNhat', 'like', "Nhận hàng - phiếu nhập {$ma} (%")
                ->whereNotNull('MaTaiKhoan')
                ->orderByDesc('ThoiGianCapNhat')
                ->value('MaTaiKhoan');

            if ($maTaiKhoan) {
                DB::table('phieu_nhap')->where('MaPhieuNhap', $ma)->update(['MaTaiKhoanNhan' => $maTaiKhoan]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('phieu_nhap', function (Blueprint $table) {
            $table->dropForeign(['MaTaiKhoanDuyet']);
            $table->dropForeign(['MaTaiKhoanNhan']);
            $table->dropColumn(['MaTaiKhoanDuyet', 'NgayDuyet', 'MaTaiKhoanNhan', 'NgayNhan']);
        });
    }
};

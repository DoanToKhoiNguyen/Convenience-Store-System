<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lich_dang_ky', function (Blueprint $table) {
            // Unique hiện có bắt đầu bằng MaTaiKhoan nên không dùng được cho
            // truy vấn đếm chỗ theo (NgayDangKy, MaCa).
            $table->index(['NgayDangKy', 'MaCa'], 'lich_dang_ky_ngay_ca_index');
        });
    }

    public function down(): void
    {
        Schema::table('lich_dang_ky', function (Blueprint $table) {
            $table->dropIndex('lich_dang_ky_ngay_ca_index');
        });
    }
};

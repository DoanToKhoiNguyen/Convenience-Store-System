<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hệ thống tự trừ kho khi lô hết hạn nên không có tài khoản thực hiện.
        Schema::table('cap_nhat_ton_kho', function (Blueprint $table) {
            $table->unsignedBigInteger('MaTaiKhoan')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('cap_nhat_ton_kho')->whereNull('MaTaiKhoan')->delete();

        Schema::table('cap_nhat_ton_kho', function (Blueprint $table) {
            $table->unsignedBigInteger('MaTaiKhoan')->nullable(false)->change();
        });
    }
};

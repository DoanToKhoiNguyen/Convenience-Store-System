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
        Schema::create('khuyen_mai', function (Blueprint $table) {
            $table->id('MaKhuyenMai');
            $table->string('TenChuongTrinh');
            $table->decimal('GiaTriGiam', 10, 2);
            $table->decimal('DieuKienApDung', 12, 2)->default(0);
            $table->dateTime('NgayBatDau');
            $table->dateTime('NgayKetThuc');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('khuyen_mai');
    }
};

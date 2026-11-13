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
        Schema::create('danh_muc', function (Blueprint $table) {
            $table->id('MaDanhMuc');
            $table->string('TenDanhMuc')->unique();
            $table->string('MoTa')->nullable();
            $table->timestamps();
        });

        Schema::table('san_pham', function (Blueprint $table) {
            $table->foreignId('MaDanhMuc')->nullable()
                ->constrained('danh_muc', 'MaDanhMuc')->restrictOnDelete();
        });

        // Chuyển các loại sản phẩm đang có thành danh mục
        $ten = DB::table('san_pham')
            ->whereNotNull('LoaiSanPham')
            ->pluck('LoaiSanPham')
            ->map(fn ($t) => trim($t))
            ->filter()
            ->unique()
            ->values();

        foreach ($ten as $t) {
            DB::table('danh_muc')->insert([
                'TenDanhMuc' => $t,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::statement('
            UPDATE san_pham
            SET "MaDanhMuc" = dm."MaDanhMuc"
            FROM danh_muc dm
            WHERE TRIM(san_pham."LoaiSanPham") = dm."TenDanhMuc"
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('san_pham', function (Blueprint $table) {
            $table->dropConstrainedForeignId('MaDanhMuc');
        });
        Schema::dropIfExists('danh_muc');
    }
};

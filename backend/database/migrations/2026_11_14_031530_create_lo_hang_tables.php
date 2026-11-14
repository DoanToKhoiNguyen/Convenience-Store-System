<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('san_pham', function (Blueprint $table) {
            $table->string('TienToLo', 10)->nullable();
            $table->unsignedInteger('SoLoCuoi')->default(0); // số thứ tự lô đã cấp
        });

        Schema::create('lo_hang', function (Blueprint $table) {
            $table->id('MaLoHang');
            $table->string('MaLo', 30)->unique();               // ví dụ CC-001
            $table->foreignId('MaSanPham')->constrained('san_pham', 'MaSanPham')->cascadeOnDelete();
            $table->unsignedBigInteger('MaPhieuNhap')->nullable()->index();
            $table->unsignedBigInteger('MaChiTietPhieuNhap')->nullable()->index();
            $table->dateTime('NgayNhap');
            $table->date('HanSuDung')->nullable();
            $table->integer('SoLuongNhap');
            $table->integer('SoLuongCon');
            $table->string('GhiChu')->nullable();
            $table->timestamps();
            $table->index(['MaSanPham', 'HanSuDung']);
        });

        Schema::create('hoa_don_lo', function (Blueprint $table) {
            $table->id('MaHoaDonLo');
            $table->foreignId('MaChiTietHoaDon')->constrained('chi_tiet_hoa_don', 'MaChiTietHoaDon')->cascadeOnDelete();
            $table->foreignId('MaLoHang')->constrained('lo_hang', 'MaLoHang')->cascadeOnDelete();
            $table->integer('SoLuong');
            $table->timestamps();
        });

        // Gán tiền tố cho sản phẩm cũ và gom số đang tồn vào một lô "tồn đầu kỳ" chưa có hạn dùng
        $daDung = [];
        $sanPhams = DB::table('san_pham')->orderBy('MaSanPham')->get(['MaSanPham', 'TenSanPham', 'SoLuongHienTai']);

        foreach ($sanPhams as $sp) {
            $goc = '';
            foreach (preg_split('/[^A-Za-z0-9]+/', Str::ascii($sp->TenSanPham), -1, PREG_SPLIT_NO_EMPTY) as $tu) {
                $goc .= strtoupper($tu[0]);
                if (strlen($goc) >= 3) {
                    break;
                }
            }
            $goc = $goc !== '' ? $goc : 'SP';

            $tienTo = $goc;
            $i = 2;
            while (isset($daDung[$tienTo])) {
                $tienTo = $goc . $i++;
            }
            $daDung[$tienTo] = true;

            $soLuong = max(0, (int) $sp->SoLuongHienTai);
            $soLo = 0;

            if ($soLuong > 0) {
                $soLo = 1;
                DB::table('lo_hang')->insert([
                    'MaLo'        => "{$tienTo}-001",
                    'MaSanPham'   => $sp->MaSanPham,
                    'NgayNhap'    => now(),
                    'HanSuDung'   => null,
                    'SoLuongNhap' => $soLuong,
                    'SoLuongCon'  => $soLuong,
                    'GhiChu'      => 'Tồn đầu kỳ',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            DB::table('san_pham')->where('MaSanPham', $sp->MaSanPham)
                ->update(['TienToLo' => $tienTo, 'SoLoCuoi' => $soLo]);
        }

        Schema::table('san_pham', function (Blueprint $table) {
            $table->unique('TienToLo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hoa_don_lo');
        Schema::dropIfExists('lo_hang');
        Schema::table('san_pham', function (Blueprint $table) {
            $table->dropUnique(['TienToLo']);
            $table->dropColumn(['TienToLo', 'SoLoCuoi']);
        });
    }
};
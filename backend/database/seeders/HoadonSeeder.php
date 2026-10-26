<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\HoaDon;
use App\Models\TaiKhoan;
use App\Models\KhuyenMai;
use Carbon\Carbon;

class HoadonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $nhanVien = TaiKhoan::first();
        $khuyenMai = KhuyenMai::first();

        if($nhanVien){
            HoaDon::create([
                'MaTaiKhoan' => $nhanVien->MaTaiKhoan,
                'MaKhuyenMai' => null,
                'TongTien' => 0,
                'TienGiamGia' => 0,
                'NgayLap' => Carbon::now(),
                'MaGiaoDich' => 'CK',
                'TenGiaoDich' => 'Chuyển khoản',
                'TrangThaiHoaDon' => false,
            ]);
        }
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ChiTietHoaDon;
use App\Models\HoaDon;
use App\Models\SanPham;
use App\Models\KhuyenMai;

class ChiTietHoaDonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $hoaDon = HoaDon::first();
        $sanPham = SanPham::first();
        $khuyenMais = KhuyenMai::all();

        if ($hoaDon && $sanPham) {
            $soLuong = 5; 
            $thanhTien = $soLuong * $sanPham->DonGiaBan;

            ChiTietHoaDon::create([
                'MaHoaDon' => $hoaDon->MaHoaDon,
                'MaSanPham' => $sanPham->MaSanPham,
                'TenSanPham' => $sanPham->TenSanPham,
                'SoLuong' => $soLuong,
                'ThanhTien' => $thanhTien,
            ]);

            $maKhuyenMai = null;
            $tienGiamGia = 0;
            $km = $khuyenMais->where('DieuKienApDung', '<=', $thanhTien)->first();

            if ($km) {
                $maKhuyenMai = $km->MaKhuyenMai;
                $tienGiamGia = $thanhTien * ($km->PhanTramGiam / 100);
            }

            $hoaDon->update([
                'TongTien' => $thanhTien,
                'TienGiamGia' => $tienGiamGia,
                'MaKhuyenMai' => $maKhuyenMai,
            ]);
        }
    }
}

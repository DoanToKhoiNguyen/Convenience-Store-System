<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\SanPham;

class SanPhamSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $sanPhams = [
            [
                'TenSanPham' => 'Nước ngọt Coca Cola 330ml',
                'DonGiaBan' => 10000.00,
                'TonKhoToiThieu' => 20,
                'TonKhoToiDa' => 500,
                'CanhBaoHSD' => 30, // Số ngày cảnh báo trước hạn sử dụng
                'SoLuongHienTai' => 150,
                'TenThuongHieu' => 'Coca Cola',
                'MoTa' => 'Nước giải khát có gas vị nguyên bản',
                'ThanhPhan' => 'Nước bão hòa CO2, đường mía, màu thực phẩm',
                'LoaiSanPham' => 'Đồ uống',
            ],
            [
                'TenSanPham' => 'Mì tôm Hảo Hảo chua cay',
                'DonGiaBan' => 4500.00,
                'TonKhoToiThieu' => 50,
                'TonKhoToiDa' => 1000,
                'CanhBaoHSD' => 60,
                'SoLuongHienTai' => 300,
                'TenThuongHieu' => 'VinaAcecook',
                'MoTa' => 'Mì ăn liền hương vị tôm chua cay đặc trưng',
                'ThanhPhan' => 'Vắt mì: Bột mì, dầu thực phẩm, tinh bột... Gói gia vị...',
                'LoaiSanPham' => 'Thực phẩm khô',
            ],
            [
                'TenSanPham' => 'Bánh snack khoai tây Oishi',
                'DonGiaBan' => 6000.00,
                'TonKhoToiThieu' => 15,
                'TonKhoToiDa' => 300,
                'CanhBaoHSD' => 45,
                'SoLuongHienTai' => 120,
                'TenThuongHieu' => 'Oishi',
                'MoTa' => 'Snack khoai tây giòn rụm thơm ngon',
                'ThanhPhan' => 'Khoai tây tươi, dầu ăn, bột gia vị',
                'LoaiSanPham' => 'Đồ ăn vặt',
            ],
        ];

        foreach ($sanPhams as $sanPham) {
            SanPham::create($sanPham);
        }
    }
}

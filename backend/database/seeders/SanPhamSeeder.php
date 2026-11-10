<?php

namespace Database\Seeders;

use App\Models\NhaCungCap;
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
        $nhaCungCap = NhaCungCap::all();

        if($nhaCungCap->isEmpty()){
            return;
        }

        $sanPhams = [
            [
                'TenSanPham' => 'Nước ngọt Coca Cola 330ml',
                'DonGiaBan' => 10000.00,
                'DonGiaNhap' => 8000.00,
                'TonKhoToiThieu' => 20,
                'TonKhoToiDa' => 500,
                'CanhBaoHSD' => 30, // Số ngày cảnh báo trước hạn sử dụng
                'SoLuongHienTai' => 150,
                'TenThuongHieu' => 'Coca Cola',
                'MoTa' => 'Nước giải khát có gas vị nguyên bản',
                'ThanhPhan' => 'Nước bão hòa CO2, đường mía, màu thực phẩm',
                'LoaiSanPham' => 'Đồ uống',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Mì tôm Hảo Hảo chua cay',
                'DonGiaBan' => 4500.00,
                'DonGiaNhap' => 3000.00,
                'TonKhoToiThieu' => 50,
                'TonKhoToiDa' => 1000,
                'CanhBaoHSD' => 60,
                'SoLuongHienTai' => 300,
                'TenThuongHieu' => 'VinaAcecook',
                'MoTa' => 'Mì ăn liền hương vị tôm chua cay đặc trưng',
                'ThanhPhan' => 'Vắt mì: Bột mì, dầu thực phẩm, tinh bột... Gói gia vị...',
                'LoaiSanPham' => 'Thực phẩm khô',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Bánh snack khoai tây Oishi',
                'DonGiaBan' => 6000.00,
                'DonGiaNhap' => 5000.00,
                'TonKhoToiThieu' => 15,
                'TonKhoToiDa' => 300,
                'CanhBaoHSD' => 45,
                'SoLuongHienTai' => 120,
                'TenThuongHieu' => 'Oishi',
                'MoTa' => 'Snack khoai tây giòn rụm thơm ngon',
                'ThanhPhan' => 'Khoai tây tươi, dầu ăn, bột gia vị',
                'LoaiSanPham' => 'Đồ ăn vặt',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Sữa tươi tiệt trùng Vinamilk 1L',
                'DonGiaBan' => 32000.00,
                'DonGiaNhap' => 27000.00,
                'TonKhoToiThieu' => 10,
                'TonKhoToiDa' => 200,
                'CanhBaoHSD' => 15,
                'SoLuongHienTai' => 80,
                'TenThuongHieu' => 'Vinamilk',
                'MoTa' => 'Sữa tươi 100% nguyên chất bổ sung dưỡng chất',
                'ThanhPhan' => 'Sữa bò tươi (100%), vitamin D3,A',
                'LoaiSanPham' => 'Sữa & Sản phẩm từ sữa',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Trà xanh không độ chai 455ml',
                'DonGiaBan' => 10000.00,
                'DonGiaNhap' => 7500.00,
                'TonKhoToiThieu' => 20,
                'TonKhoToiDa' => 400,
                'CanhBaoHSD' => 30,
                'SoLuongHienTai' => 210,
                'TenThuongHieu' => 'Tan Hiep Phat',
                'MoTa' => 'Trà xanh đóng chai thanh mát giải nhiệt',
                'ThanhPhan' => 'Nước tinh khiết, lá trà xanh, đường, hương hoa lài',
                'LoaiSanPham' => 'Đồ uống',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Bánh quy Cosy nhân kem bơ',
                'DonGiaBan' => 22000.00,
                'DonGiaNhap' => 18000.00,
                'TonKhoToiThieu' => 10,
                'TonKhoToiDa' => 250,
                'CanhBaoHSD' => 45,
                'SoLuongHienTai' => 95,
                'TenThuongHieu' => 'Cosy',
                'MoTa' => 'Bánh quy thơm bơ với lớp nhân kem ngọt ngào',
                'ThanhPhan' => 'Bột mì, đường, dầu thực phẩm, bơ, sữa bột',
                'LoaiSanPham' => 'Đồ ăn vặt',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Nước khoáng thiên nhiên Lavie 500ml',
                'DonGiaBan' => 6000.00,
                'DonGiaNhap' => 4000.00,
                'TonKhoToiThieu' => 30,
                'TonKhoToiDa' => 600,
                'CanhBaoHSD' => 90,
                'SoLuongHienTai' => 400,
                'TenThuongHieu' => 'Lavie',
                'MoTa' => 'Nước khoáng đóng chai tinh khiết từ thiên nhiên',
                'ThanhPhan' => 'Nước khoáng thiên nhiên chứa hàm lượng nhẹ các khoáng chất',
                'LoaiSanPham' => 'Đồ uống',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Kẹo cao su Lotte Xylitol bạc hà',
                'DonGiaBan' => 25000.00,
                'DonGiaNhap' => 20000.00,
                'TonKhoToiThieu' => 15,
                'TonKhoToiDa' => 300,
                'CanhBaoHSD' => 60,
                'SoLuongHienTai' => 130,
                'TenThuongHieu' => 'Lotte',
                'MoTa' => 'Kẹo cao su không đường hương bạc hà thơm miệng',
                'ThanhPhan' => 'Chất gôm, chất tạo ngọt Xylitol, hương bạc hà tự nhiên',
                'LoaiSanPham' => 'Đồ ăn vặt',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Xúc xích ăn liền Vissan Đức Việt 3 cây',
                'DonGiaBan' => 15000.00,
                'DonGiaNhap' => 12000.00,
                'TonKhoToiThieu' => 20,
                'TonKhoToiDa' => 300,
                'CanhBaoHSD' => 20,
                'SoLuongHienTai' => 110,
                'TenThuongHieu' => 'Vissan',
                'MoTa' => 'Xúc xích tiệt trùng tiện lợi giàu dinh dưỡng',
                'ThanhPhan' => 'Thịt heo, mỡ heo, tinh bột, muối, đường, gia vị',
                'LoaiSanPham' => 'Thực phẩm nhanh',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
            [
                'TenSanPham' => 'Pin tiểu năng lượng cao Alkaline Maxell AA',
                'DonGiaBan' => 18000.00,
                'DonGiaNhap' => 13000.00,
                'TonKhoToiThieu' => 10,
                'TonKhoToiDa' => 150,
                'CanhBaoHSD' => 365,
                'SoLuongHienTai' => 65,
                'TenThuongHieu' => 'Maxell',
                'MoTa' => 'Vỉ 2 viên pin tiểu AA dùng cho các thiết bị điện tử',
                'ThanhPhan' => 'Kẽm, mangan dioxide, kiềm',
                'LoaiSanPham' => 'Hàng gia dụng',
                'TrangThai' => true,
                'MaNhaCungCap' => $nhaCungCap->random()->MaNhaCungCap,
            ],
        ];

        foreach ($sanPhams as $sanPham) {
            SanPham::updateOrCreate(
                ['TenSanPham' => $sanPham['TenSanPham']], // Điều kiện tìm kiếm theo tên
                $sanPham // Dữ liệu để cập nhật hoặc tạo mới
            );
        }
    }
}
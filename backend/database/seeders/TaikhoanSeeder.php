<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\TaiKhoan;
use Illuminate\Support\Facades\Hash;

class TaikhoanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Tài khoản Chủ
        TaiKhoan::create([
            'TenDangNhap' => 'admin',
            'MatKhau' => Hash::make('123456'),
            'HoTen' => 'Chủ Doanh Nghiệp',
            'Email' => 'admin@conveniencestore.com',
            'SoDienThoai' => '090000001',
            'TrangThai' => true,
            'MaVaiTro' => '1' // Giả sử bảng tài khoản có cột VaiTro
        ]);

        // Tài khoản Quản lý
        TaiKhoan::create([
            'TenDangNhap' => 'quanly',
            'MatKhau' => Hash::make('123456'),
            'HoTen' => 'Quản Lý Hệ Thống',
            'Email' => 'quanly@conveniencestore.com',
            'SoDienThoai' => '0900000001',
            'TrangThai' => true,
            'MaVaiTro' => '2' // Giả sử bảng tài khoản có cột VaiTro
        ]);

        // Tài khoản Nhân viên
        TaiKhoan::create([
            'TenDangNhap' => 'nhanvien01',
            'MatKhau' => Hash::make('123456'),
            'HoTen' => 'Nhân Viên 01',
            'Email' => 'nhanvien01@conveniencestore.com',
            'SoDienThoai' => '0900000002',
            'TrangThai' => true,
            'MaVaiTro' => '3'
        ]);
    }
}

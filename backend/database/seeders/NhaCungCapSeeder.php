<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\NhaCungCap;

class NhaCungCapSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $nhaCCs = [
            [
                'TenNhaCungCap' => 'Công ty TNHH Nước Giải Khát Coca-Cola Việt Nam',
                'DiaChi' => 'Thành phố Thủ Đức, TP. Hồ Chí Minh',
                'SoDienThoai' => '02838966000',              
            ],
            [
                'TenNhaCungCap' => 'Công ty Cổ phần Acecook Việt Nam',
                'DiaChi' => 'Khu công nghiệp Tân Bình, TP. Hồ Chí Minh',
                'SoDienThoai' => '02838154064',                
            ],
        ];

        foreach ($nhaCCs as $ncc) {
            NhaCungCap::create($ncc);
        }
    }
}

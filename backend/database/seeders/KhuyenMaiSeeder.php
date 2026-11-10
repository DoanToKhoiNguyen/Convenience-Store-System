<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\KhuyenMai;
use Carbon\Carbon;

class KhuyenMaiSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        KhuyenMai::updateOrCreate(
            ['TenChuongTrinh' => 'Khuyến mãi khai trương giảm 10%'],
            [
                'LoaiGiam'      => 'phan_tram',
                'GiaTriGiam'    => 10.00,
                'GiamToiDa'     => 50000.00,
                'DieuKienApDung' => 100000.00,
                'NgayBatDau'    => Carbon::now()->subDays(5),
                'NgayKetThuc'   => Carbon::now()->addDays(25),
                'TrangThai'     => true,
            ]
        );

        // 2. Khuyến mãi đại tiệc cuối tuần
        KhuyenMai::updateOrCreate(
            ['TenChuongTrinh' => 'Đại tiệc cuối tuần giảm 15%'],
            [
                'LoaiGiam'      => 'phan_tram',
                'GiaTriGiam'    => 15.00,
                'GiamToiDa'     => 100000.00,
                'DieuKienApDung' => 200000.00,
                'NgayBatDau'    => Carbon::now()->subDays(1),
                'NgayKetThuc'   => Carbon::now()->addDays(2),
                'TrangThai'     => true,
            ]
        );
    }
}

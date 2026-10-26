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
        $khuyenMais = [
            [
                'TenChuongTrinh' => 'Khuyến mãi khai trương giảm 10%',
                'GiaTriGiam' => 10.00,
                'DieuKienApDung' => 5000.00,
                'NgayBatDau' => Carbon::now()->subDays(5),
                'NgayKetThuc' => Carbon::now()->addDays(25),
            ],
            [
                'TenChuongTrinh' => 'Đại tiệc cuối tuần giảm 15%',
                'GiaTriGiam' => 15.00,
                'DieuKienApDung' => 100000.00,
                'NgayBatDau' => Carbon::now()->subDays(1),
                'NgayKetThuc' => Carbon::now()->addDays(2),
            ],
        ];
        foreach($khuyenMais as $km){
            KhuyenMai::create($km);
        }
    }
}

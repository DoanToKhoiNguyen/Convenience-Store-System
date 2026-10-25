<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\VaiTro;

class VaiTroSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $vaiTros = [
            ['MaVaiTro' => '1', 'TenVaiTro' => 'Chủ doanh nghiệp'],
            ['MaVaiTro' => '2', 'TenVaiTro' => 'Quản lý'],
            ['MaVaiTro' => '3', 'TenVaiTro' => 'Nhân viên'],
        ];

        foreach ($vaiTros as $vaiTro) {
            VaiTro::create($vaiTro);
        }
    }
}

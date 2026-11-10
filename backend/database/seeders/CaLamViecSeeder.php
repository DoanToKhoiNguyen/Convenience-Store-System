<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\CaLamViec;

class CaLamViecSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach ([
            ['TenCa' => 'Ca sáng',  'GioBatDau' => '06:00', 'GioKetThuc' => '14:00'],
            ['TenCa' => 'Ca chiều', 'GioBatDau' => '14:00', 'GioKetThuc' => '22:00'],
            ['TenCa' => 'Ca tối',   'GioBatDau' => '22:00', 'GioKetThuc' => '06:00'],
        ] as $ca) {
            CaLamViec::updateOrCreate(['TenCa' => $ca['TenCa']], $ca);
        }
    }
}

<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            VaiTroSeeder::class,
            TaiKhoanSeeder::class,
            NhaCungCapSeeder::class,
            SanPhamSeeder::class,
            KhuyenMaiSeeder::class,
            HoaDonSeeder::class,         
            ChiTietHoaDonSeeder::class,
        ]);
        $this->call(CaLamViecSeeder::class);
        // User::factory(10)->create();
        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
        app(\App\Domains\LoHang\Services\LoHangService::class)->dongBoTatCa();
        \Illuminate\Support\Facades\DB::statement('
            INSERT INTO nha_cung_cap_danh_muc ("MaNhaCungCap", "MaDanhMuc")
            SELECT DISTINCT "MaNhaCungCap", "MaDanhMuc" FROM san_pham
            WHERE "MaNhaCungCap" IS NOT NULL AND "MaDanhMuc" IS NOT NULL
            ON CONFLICT DO NOTHING
        ');
    }
}

<?php

namespace Tests\Feature;

use App\Models\NhaCungCap;
use App\Models\PhieuNhap;
use App\Models\SanPham;
use App\Models\TaiKhoan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhieuNhapMaTest extends TestCase
{
    use RefreshDatabase;

    private TaiKhoan $admin;
    private NhaCungCap $ncc;
    private SanPham $sp1;
    private SanPham $sp2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = TaiKhoan::create([
            'TenDangNhap' => 'quanly',
            'MatKhau' => bcrypt('123456'),
            'HoTen' => 'Quản lý',
            'Email' => 'quanly@test.local',
            'TrangThai' => true,
            'MaVaiTro' => '1',
        ]);
        $this->app['auth']->forgetGuards();
        $this->withToken($this->admin->createToken('test')->plainTextToken);

        $this->ncc = NhaCungCap::create([
            'TenNhaCungCap' => 'NCC Test',
            'DiaChi' => 'Quận 1',
            'SoDienThoai' => '0900000000',
            'TrangThai' => true,
        ]);

        foreach (['Sữa hộp', 'Bánh quy'] as $ten) {
            $sp = SanPham::create([
                'TenSanPham' => $ten,
                'MaNhaCungCap' => $this->ncc->MaNhaCungCap,
                'DonGiaNhap' => 1500,
                'SoLuongHienTai' => 0,
                'TrangThai' => true,
            ]);
            $this->sp1 ??= $sp;
            if ($this->sp1->MaSanPham !== $sp->MaSanPham) {
                $this->sp2 = $sp;
            }
        }
    }

    private function datHang(SanPham $sp)
    {
        return $this->postJson('/api/phieu-nhap', [
            'MaNhaCungCap' => $this->ncc->MaNhaCungCap,
            'ChiTiet' => [['MaSanPham' => $sp->MaSanPham, 'SoLuong' => 3]],
        ]);
    }

    private function phieu(string $ma, int $trangThai): void
    {
        PhieuNhap::create([
            'MaPhieuNhap' => $ma,
            'MaTaiKhoan' => $this->admin->MaTaiKhoan,
            'MaNhaCungCap' => $this->ncc->MaNhaCungCap,
            'TrangThai' => $trangThai,
        ]);
    }

    public function test_ma_phieu_tu_dong_tang_dan_dang_pn(): void
    {
        $a = $this->datHang($this->sp1);
        $a->assertCreated()->assertJsonPath('data.MaPhieuNhap', 'PN01');

        $b = $this->datHang($this->sp2);
        $b->assertCreated()->assertJsonPath('data.MaPhieuNhap', 'PN02');

        $this->assertDatabaseHas('phieu_nhap', ['MaPhieuNhap' => 'PN01', 'TrangThai' => 1]);
        $this->assertDatabaseHas('chi_tiet_phieu_nhap', ['MaPhieuNhap' => 'PN01', 'MaSanPham' => $this->sp1->MaSanPham]);

        // Mã chuỗi phải đi được qua route duyệt phiếu
        $this->postJson('/api/phieu-nhap/PN01/duyet')
            ->assertOk()
            ->assertJsonPath('data.MaPhieuNhap', 'PN01');

        $this->assertSame(2, (int) PhieuNhap::find('PN01')->TrangThai);
        $this->assertSame(1, (int) PhieuNhap::find('PN02')->TrangThai);
    }

    public function test_duyet_va_nhan_hang_luu_nguoi_va_thoi_diem(): void
    {
        $ma = $this->datHang($this->sp1)->json('data.MaPhieuNhap');

        $this->postJson("/api/phieu-nhap/{$ma}/duyet")->assertOk();
        $phieu = PhieuNhap::find($ma);
        $this->assertSame((int) $this->admin->MaTaiKhoan, (int) $phieu->MaTaiKhoanDuyet);
        $this->assertNotNull($phieu->NgayDuyet);

        $chiTiet = $phieu->chiTietPhieuNhap()->first();
        $this->putJson("/api/phieu-nhap/{$ma}/nhan-hang", [
            'ChiTiet' => [['MaChiTietPhieuNhap' => $chiTiet->MaChiTietPhieuNhap, 'HanSuDung' => null]],
        ])->assertOk();

        $phieu->refresh();
        $this->assertSame(4, (int) $phieu->TrangThai);
        $this->assertSame((int) $this->admin->MaTaiKhoan, (int) $phieu->MaTaiKhoanNhan);
        $this->assertNotNull($phieu->NgayNhan);
    }

    public function test_ma_tiep_noi_sau_so_lon_nhat(): void
    {
        PhieuNhap::create([
            'MaPhieuNhap' => 'PN99',
            'MaTaiKhoan' => $this->admin->MaTaiKhoan,
            'MaNhaCungCap' => $this->ncc->MaNhaCungCap,
            'TrangThai' => 3,
        ]);

        $this->datHang($this->sp1)->assertCreated()->assertJsonPath('data.MaPhieuNhap', 'PN100');
    }

    public function test_dem_va_loc_phieu_theo_trang_thai(): void
    {
        $this->phieu('PN21', 1);
        $this->phieu('PN22', 2);
        $this->phieu('PN23', 3);
        $this->phieu('PN24', 4);

        $res = $this->getJson('/api/phieu-nhap?TrangThai=2');

        $res->assertOk()
            ->assertJsonPath('counts.tong', 4)
            ->assertJsonPath('counts.cho_duyet', 1)
            ->assertJsonPath('counts.cho_nhan', 1)
            ->assertJsonPath('counts.da_huy', 1)
            ->assertJsonPath('counts.da_nhan', 1)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.MaPhieuNhap', 'PN22');
    }

    public function test_nhan_vien_chi_dem_nhung_phieu_duoc_thay(): void
    {
        $this->phieu('PN21', 1);
        $this->phieu('PN22', 2);
        $this->phieu('PN23', 3);
        $this->phieu('PN24', 4);

        $nhanVien = TaiKhoan::create([
            'TenDangNhap' => 'nhanvien',
            'MatKhau' => bcrypt('123456'),
            'HoTen' => 'Nhân viên',
            'Email' => 'nhanvien@test.local',
            'TrangThai' => true,
            'MaVaiTro' => '3',
        ]);
        $this->app['auth']->forgetGuards();
        $this->withToken($nhanVien->createToken('test')->plainTextToken);

        $this->getJson('/api/phieu-nhap')
            ->assertOk()
            ->assertJsonPath('counts.tong', 2)
            ->assertJsonPath('counts.cho_duyet', 0)
            ->assertJsonPath('counts.cho_nhan', 1)
            ->assertJsonPath('counts.da_huy', 0)
            ->assertJsonPath('counts.da_nhan', 1);
    }
}

<?php

namespace Tests\Feature;

use App\Domains\LoHang\Services\LoHangService;
use App\Models\CapNhatTonKho;
use App\Models\LoHang;
use App\Models\LoHangDaLoai;
use App\Models\NhaCungCap;
use App\Models\SanPham;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class LoaiLoHetHanTest extends TestCase
{
    use RefreshDatabase;

    private SanPham $sp;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-23 10:00:00'));

        $nvcc = NhaCungCap::create([
            'TenNhaCungCap' => 'NCC Test',
            'DiaChi' => 'Quận 1',
            'SoDienThoai' => '0900000000',
            'TrangThai' => true,
        ]);

        $this->sp = SanPham::create([
            'TenSanPham' => 'Sữa hộp',
            'SoLuongHienTai' => 0,
            'TrangThai' => true,
            'MaNhaCungCap' => $nvcc->MaNhaCungCap,
            'CanhBaoHSD' => 30,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function lo(string $maLo, ?string $han, int $soLuong): LoHang
    {
        return LoHang::create([
            'MaLo' => $maLo,
            'MaSanPham' => $this->sp->MaSanPham,
            'NgayNhap' => Carbon::now()->subDays(5),
            'HanSuDung' => $han,
            'SoLuongNhap' => $soLuong,
            'SoLuongCon' => $soLuong,
        ]);
    }

    public function test_tu_dong_loai_lo_het_han_va_giu_lai_lo_con_han(): void
    {
        $hetHan = $this->lo('SP-001', '2026-11-20', 4);
        $conHan = $this->lo('SP-002', '2026-12-30', 3);
        $khongHan = $this->lo('SP-003', null, 2);
        $this->sp->update(['SoLuongHienTai' => 9]);

        $soLo = app(LoHangService::class)->loaiLoHetHan();

        $this->assertSame(1, $soLo);
        $this->assertSame(0, (int) $hetHan->fresh()->SoLuongCon, 'Lô hết hạn phải bị đưa về 0.');
        $this->assertSame(3, (int) $conHan->fresh()->SoLuongCon);
        $this->assertSame(2, (int) $khongHan->fresh()->SoLuongCon);
        $this->assertSame(5, (int) $this->sp->fresh()->SoLuongHienTai, 'Tồn kho phải giảm đúng số hàng hết hạn.');

        $nhatKy = LoHangDaLoai::sole();
        $this->assertSame((int) $hetHan->MaLoHang, (int) $nhatKy->MaLoHang);
        $this->assertSame('Sữa hộp', $nhatKy->TenSanPham);
        $this->assertSame('SP-001', $nhatKy->MaLo);
        $this->assertSame('2026-11-20', $nhatKy->HanSuDung->toDateString());
        $this->assertSame(4, (int) $nhatKy->SoLuongLoai);
        $this->assertNull($nhatKy->MaTaiKhoan, 'Hệ thống tự loại nên không có tài khoản.');

        $ghiChu = CapNhatTonKho::orderByDesc('MaCapNhat')->first();
        $this->assertNull($ghiChu->MaTaiKhoan);
        $this->assertStringContainsString('tự động loại lô SP-001', $ghiChu->LyDoCapNhat);

        // Chạy lại không được loại lần nữa
        $this->assertSame(0, app(LoHangService::class)->loaiLoHetHan());
        $this->assertSame(1, LoHangDaLoai::count());
    }

    public function test_lo_het_han_nhung_da_het_hang_thi_khong_ghi_nhat_ky(): void
    {
        $this->lo('SP-001', '2026-11-20', 0);

        $this->assertSame(0, app(LoHangService::class)->loaiLoHetHan());
        $this->assertSame(0, LoHangDaLoai::count());
    }
}

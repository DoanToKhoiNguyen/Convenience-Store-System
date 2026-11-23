<?php

namespace Tests\Feature;

use App\Domains\LoHang\Services\LoHangService;
use App\Models\LoHang;
use App\Models\NhaCungCap;
use App\Models\SanPham;
use App\Models\TaiKhoan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class XuatKhoTheoLotTest extends TestCase
{
    use RefreshDatabase;

    private TaiKhoan $user;
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
        ]);

        $this->user = TaiKhoan::create([
            'TenDangNhap' => 'nhanvien-test',
            'MatKhau' => bcrypt('123456'),
            'HoTen' => 'NV Test',
            'Email' => 'nv@test.local',
            'TrangThai' => true,
            'MaVaiTro' => '3',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function lo(string $maLo, int $nhapTruocBaoNhieuNgay, ?string $han, int $soLuong): LoHang
    {
        return LoHang::create([
            'MaLo' => $maLo,
            'MaSanPham' => $this->sp->MaSanPham,
            'NgayNhap' => Carbon::now()->subDays($nhapTruocBaoNhieuNgay),
            'HanSuDung' => $han,
            'SoLuongNhap' => $soLuong,
            'SoLuongCon' => $soLuong,
        ]);
    }

    private function datTon(int $soLuong): void
    {
        $this->sp->update(['SoLuongHienTai' => $soLuong]);
    }

    private function ban(int $soLuong): array
    {
        return DB::transaction(fn () => app(LoHangService::class)->xuatBan(
            (int) $this->sp->MaSanPham,
            $soLuong,
            'Bán hàng test',
            (int) $this->user->MaTaiKhoan,
        ));
    }

    public function test_ban_hang_tru_het_lo_nhap_truoc_roi_moi_toi_lo_nhap_sau(): void
    {
        $cu = $this->lo('SP-001', 10, null, 5);         // nhập trước, không có hạn
        $moi = $this->lo('SP-002', 1, '2027-06-30', 5); // nhập sau, hạn còn xa
        $this->datTon(10);

        $chia = $this->ban(6);

        $this->assertSame(0, (int) $cu->fresh()->SoLuongCon, 'Lô nhập trước phải bị trừ hết trước.');
        $this->assertSame(4, (int) $moi->fresh()->SoLuongCon);
        $this->assertSame([
            ['MaLoHang' => (int) $cu->MaLoHang, 'MaLo' => 'SP-001', 'SoLuong' => 5],
            ['MaLoHang' => (int) $moi->MaLoHang, 'MaLo' => 'SP-002', 'SoLuong' => 1],
        ], $chia);
        $this->assertSame(4, (int) $this->sp->fresh()->SoLuongHienTai);
    }

    public function test_ban_hang_bo_qua_lo_da_het_han_du_lo_do_nhap_truoc(): void
    {
        $hetHan = $this->lo('SP-001', 10, '2026-11-20', 5); // nhập trước nhưng đã hết hạn
        $conHan = $this->lo('SP-002', 1, null, 5);
        $this->datTon(10);

        $chia = $this->ban(2);

        $this->assertSame(5, (int) $hetHan->fresh()->SoLuongCon, 'Lô hết hạn không được bán.');
        $this->assertSame(3, (int) $conHan->fresh()->SoLuongCon);
        $this->assertSame([(int) $conHan->MaLoHang], array_column($chia, 'MaLoHang'));
    }

    public function test_ban_hang_bao_loi_khi_chi_con_lo_het_han(): void
    {
        $this->lo('SP-001', 5, '2026-11-20', 5); // đã hết hạn
        $this->lo('SP-002', 1, null, 2);
        $this->datTon(7);

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('chỉ còn 2 sản phẩm còn hạn sử dụng');

        $this->ban(3);
    }
}

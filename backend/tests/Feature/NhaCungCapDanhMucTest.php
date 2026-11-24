<?php

namespace Tests\Feature;

use App\Models\DanhMuc;
use App\Models\NhaCungCap;
use App\Models\SanPham;
use App\Models\TaiKhoan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NhaCungCapDanhMucTest extends TestCase
{
    use RefreshDatabase;

    private NhaCungCap $ncc;
    private DanhMuc $nuocNgot;
    private DanhMuc $banhKeo;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = TaiKhoan::create([
            'TenDangNhap' => 'quanly',
            'MatKhau' => bcrypt('123456'),
            'HoTen' => 'Quản lý',
            'Email' => 'quanly@test.local',
            'TrangThai' => true,
            'MaVaiTro' => '1',
        ]);
        $this->app['auth']->forgetGuards();
        $this->withToken($admin->createToken('test')->plainTextToken);

        $this->nuocNgot = DanhMuc::create(['TenDanhMuc' => 'Nước giải khát']);
        $this->banhKeo = DanhMuc::create(['TenDanhMuc' => 'Bánh kẹo']);

        $this->ncc = NhaCungCap::create([
            'TenNhaCungCap' => 'NCC Đôi Danh Mục',
            'DiaChi' => 'Quận 1',
            'SoDienThoai' => '0900000000',
            'TrangThai' => true,
        ]);
        $this->ncc->danhMuc()->sync([$this->nuocNgot->MaDanhMuc, $this->banhKeo->MaDanhMuc]);
    }

    private function sanPham(string $ten, DanhMuc $danhMuc, ?bool $trangThai): SanPham
    {
        return SanPham::create([
            'TenSanPham' => $ten,
            'MaNhaCungCap' => $this->ncc->MaNhaCungCap,
            'MaDanhMuc' => $danhMuc->MaDanhMuc,
            'SoLuongHienTai' => 0,
            'TrangThai' => $trangThai,
        ]);
    }

    private function capNhat(array $danhMuc)
    {
        return $this->putJson('/api/nha-cung-cap/' . $this->ncc->MaNhaCungCap, [
            'TenNhaCungCap' => $this->ncc->TenNhaCungCap,
            'DiaChi' => $this->ncc->DiaChi,
            'SoDienThoai' => $this->ncc->SoDienThoai,
            'DanhMuc' => array_map(fn (DanhMuc $dm) => $dm->MaDanhMuc, $danhMuc),
        ]);
    }

    private function danhMucDangLuu(): array
    {
        return $this->ncc->danhMuc()->pluck('danh_muc.MaDanhMuc')
            ->map(fn ($v) => (int) $v)->sort()->values()->all();
    }

    public function test_bo_duoc_danh_muc_khi_chi_con_san_pham_ngung_ban(): void
    {
        $this->sanPham('Trà chanh cũ', $this->nuocNgot, false);
        $this->sanPham('Bánh quy', $this->banhKeo, true);

        $this->capNhat([$this->banhKeo])->assertOk();

        $this->assertSame([(int) $this->banhKeo->MaDanhMuc], $this->danhMucDangLuu());
    }

    public function test_bo_duoc_danh_muc_khi_san_pham_chua_dat_trang_thai(): void
    {
        // TrangThai null là dữ liệu cũ, được coi là đang kinh doanh -> phải chặn
        $this->sanPham('Trà đá', $this->nuocNgot, null);

        $res = $this->capNhat([$this->banhKeo]);

        $res->assertStatus(422);
        $this->assertStringContainsString('Trà đá', $res->json('message'));
        $this->assertContains(
            (int) $this->nuocNgot->MaDanhMuc,
            $this->danhMucDangLuu(),
            'Danh mục bị chặn thì không được gỡ khỏi nhà cung cấp.'
        );
    }

    public function test_chan_theo_loai_san_pham_khi_san_pham_thieu_ma_danh_muc(): void
    {
        $sp = $this->sanPham('Trà sữa', $this->nuocNgot, true);
        $this->assertSame((int) $this->nuocNgot->MaDanhMuc, (int) $sp->fresh()->MaDanhMuc, 'MaDanhMuc phải được lưu.');

        // Sản phẩm cũ tạo trước khi có cột MaDanhMuc
        $sp->forceFill(['MaDanhMuc' => null, 'LoaiSanPham' => 'Nước giải khát'])->save();

        $res = $this->capNhat([$this->banhKeo]);

        $res->assertStatus(422);
        $this->assertStringContainsString('Trà sữa', $res->json('message'));
    }

    public function test_chan_bo_danh_muc_khi_con_san_pham_dang_ban(): void
    {
        $this->sanPham('Trà chanh cũ', $this->nuocNgot, false);
        $this->sanPham('Bánh quy', $this->banhKeo, true);
        $this->sanPham('Kẹo dẻo', $this->banhKeo, true);

        $res = $this->capNhat([$this->nuocNgot]);

        $res->assertStatus(422);
        $message = $res->json('message');
        $this->assertStringContainsString('Bánh kẹo', $message);
        $this->assertStringContainsString('Bánh quy', $message);
        $this->assertStringContainsString('Kẹo dẻo', $message);
        $this->assertStringNotContainsString('Trà chanh cũ', $message, 'Sản phẩm ngừng bán không được liệt kê.');
        $this->assertStringContainsString('đang kinh doanh', $message);

        $this->assertSame(
            collect([$this->nuocNgot->MaDanhMuc, $this->banhKeo->MaDanhMuc])->map(fn ($v) => (int) $v)->sort()->values()->all(),
            $this->danhMucDangLuu()
        );
    }
}

<?php

namespace Tests\Feature;

use App\Domains\CaLamViec\Services\TuanLamViec;
use App\Models\CaLamViec;
use App\Models\LichDangKy;
use App\Models\TaiKhoan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class LichDangKyTest extends TestCase
{
    use RefreshDatabase;

    private string $thuHai;

    protected function setUp(): void
    {
        parent::setUp();

        // Thứ 2, 23/11/2026 10:00: hạn đăng ký (23:59 thứ 7) còn mở.
        Carbon::setTestNow(Carbon::parse('2026-11-23 10:00:00'));
        $this->thuHai = TuanLamViec::tuanDangKy()['tu_ngay'];

        CaLamViec::create([
            'TenCa' => 'Ca sáng',
            'GioBatDau' => '06:00:00',
            'GioKetThuc' => '12:00:00',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function nguoiDung(string $maVaiTro, string $ten): TaiKhoan
    {
        return TaiKhoan::create([
            'TenDangNhap' => $ten,
            'MatKhau' => bcrypt('123456'),
            'HoTen' => $ten,
            'Email' => $ten . '@test.local',
            'TrangThai' => true,
            'MaVaiTro' => $maVaiTro,
        ]);
    }

    // TaiKhoan không phải Authenticatable của Laravel nên dùng token thật thay cho Sanctum::actingAs.
    private function dangNhap(TaiKhoan $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->withToken($user->createToken('test')->plainTextToken);
    }

    private function luu(TaiKhoan $user, array $slots): TestResponse
    {
        $this->dangNhap($user);

        return $this->putJson('/api/dang-ky-ca/tuan-sau', [
            'ChiTiet' => collect($slots)
                ->map(fn ($s) => ['Ngay' => $s[0], 'MaCa' => $s[1]])
                ->values()
                ->all(),
        ]);
    }

    private function soDangKy(string $ngay, int $maCa = 1): int
    {
        return LichDangKy::where('NgayDangKy', $ngay)->where('MaCa', $maCa)->count();
    }

    public function test_hai_nhan_vien_dang_ky_cung_ca_thanh_cong(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();

        $this->assertSame(2, $this->soDangKy($this->thuHai));
    }

    public function test_nhan_vien_thu_ba_bi_chan_khi_ca_du_hai_nguoi(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');
        $c = $this->nguoiDung('3', 'nhanvien-c');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();

        $this->luu($c, [[$this->thuHai, 1]])
            ->assertStatus(422)
            ->assertJsonPath('errors.ChiTiet.0', 'Ca Ca sáng ngày 30/11/2026 đã đủ 2 nhân viên.');

        $this->assertSame(2, $this->soDangKy($this->thuHai));
    }

    public function test_quan_ly_dang_ky_chung_ca_voi_hai_nhan_vien(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');
        $ql = $this->nguoiDung('2', 'quanly-a');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();
        $this->luu($ql, [[$this->thuHai, 1]])->assertOk();

        $this->assertSame(3, $this->soDangKy($this->thuHai));
    }

    public function test_quan_ly_thu_hai_bi_chan_trong_cung_ca(): void
    {
        $ql1 = $this->nguoiDung('2', 'quanly-a');
        $ql2 = $this->nguoiDung('1', 'chu-b');

        $this->luu($ql1, [[$this->thuHai, 1]])->assertOk();

        $this->luu($ql2, [[$this->thuHai, 1]])
            ->assertStatus(422)
            ->assertJsonPath('errors.ChiTiet.0', 'Ca Ca sáng ngày 30/11/2026 đã có quản lý đăng ký. Mỗi ca chỉ một quản lý hoặc chủ.');

        $this->assertSame(1, $this->soDangKy($this->thuHai));
    }

    public function test_quan_ly_dang_ky_chung_ca_voi_mot_nhan_vien(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $ql = $this->nguoiDung('2', 'quanly-a');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($ql, [[$this->thuHai, 1]])->assertOk();

        $this->assertSame(2, $this->soDangKy($this->thuHai));
    }

    public function test_luu_danh_sach_rong_huy_toan_bo_dang_ky(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->assertSame(1, $this->soDangKy($this->thuHai));

        $this->luu($a, [])
            ->assertOk()
            ->assertJsonPath('message', 'Đã hủy toàn bộ đăng ký tuần sau.');

        $this->assertSame(0, $this->soDangKy($this->thuHai));
    }

    public function test_ngay_ngoai_tuan_sau_bi_tu_choi(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');

        $this->luu($a, [['2026-12-10', 1]])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ngày 2026-12-10 không thuộc tuần sau.');
    }

    public function test_tuan_sau_tra_ve_tinh_trang_cho_trong_theo_vai_tro(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');
        $c = $this->nguoiDung('3', 'nhanvien-c');
        $ql = $this->nguoiDung('2', 'quanly-a');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();

        // Nhân viên thứ ba thấy ca đã đầy.
        $this->dangNhap($c);
        $this->getJson('/api/dang-ky-ca/tuan-sau')
            ->assertOk()
            ->assertJsonPath('da_ky.0.con_cho', false)
            ->assertJsonPath('da_ky.0.ly_do_khoa', 'du_nhan_vien')
            ->assertJsonPath('da_ky.0.so_nhan_vien', 2)
            ->assertJsonPath('gioi_han.nhan_vien', 2);

        // Quản lý vẫn thấy ca còn chỗ vì chưa có quản lý nào.
        $this->dangNhap($ql);
        $this->getJson('/api/dang-ky-ca/tuan-sau')
            ->assertOk()
            ->assertJsonPath('da_ky.0.con_cho', true)
            ->assertJsonPath('da_ky.0.ly_do_khoa', null)
            ->assertJsonPath('gioi_han.quan_ly', 1);
    }

    public function test_nhan_vien_da_dang_ky_van_thay_ca_cua_minh_con_cho(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();

        // A đã có mặt trong ca (2/2) nhưng vẫn phải giữ lại được lựa chọn của mình.
        $this->dangNhap($a);
        $this->getJson('/api/dang-ky-ca/tuan-sau')
            ->assertOk()
            ->assertJsonPath('da_ky.0.so_nhan_vien', 2)
            ->assertJsonPath('da_ky.0.con_cho', true)
            ->assertJsonPath('da_chon.0.Ngay', $this->thuHai)
            ->assertJsonPath('da_chon.0.MaCa', 1);
    }

    public function test_thoi_khoa_bieu_chi_hien_ten_nhan_vien_va_dem_so_quan_ly(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $ql = $this->nguoiDung('2', 'quanly-a');
        $chu = $this->nguoiDung('1', 'chu-a');

        // Tuần hiện tại (tuần của 23/11/2026).
        $ngay = '2026-11-24';
        foreach ([$a, $ql, $chu] as $u) {
            LichDangKy::create([
                'NgayDangKy' => $ngay,
                'TrangThai' => 1,
                'MaTaiKhoan' => $u->MaTaiKhoan,
                'MaCa' => 1,
            ]);
        }

        $this->dangNhap($ql);
        $res = $this->getJson('/api/lich-lam-viec')->assertOk();

        $data = $res->json('data');
        $this->assertCount(1, $data, 'Chỉ nhân viên mới xuất hiện trong danh sách tên.');
        $this->assertSame('nhanvien-a', $data[0]['HoTen']);
        $this->assertSame(1, $data[0]['MaCa']);

        $this->assertSame([
            ['Ngay' => $ngay, 'MaCa' => 1, 'so_luong' => 2],
        ], $res->json('quan_ly'));
    }

    public function test_tai_khoan_bi_khoa_khong_hien_trong_thoi_khoa_bieu_va_khong_tinh_cho(): void
    {
        $a = $this->nguoiDung('3', 'nhanvien-a');
        $b = $this->nguoiDung('3', 'nhanvien-b');
        $c = $this->nguoiDung('3', 'nhanvien-c');

        $this->luu($a, [[$this->thuHai, 1]])->assertOk();
        $this->luu($b, [[$this->thuHai, 1]])->assertOk();

        // B bị khóa: ca còn 1 chỗ và tên B không còn trên thời khóa biểu.
        $b->update(['TrangThai' => false]);

        $this->luu($c, [[$this->thuHai, 1]])->assertOk();
        $this->assertSame(3, $this->soDangKy($this->thuHai));

        $this->dangNhap($a);
        $this->getJson('/api/dang-ky-ca/tuan-sau')
            ->assertOk()
            ->assertJsonPath('da_ky.0.so_nhan_vien', 2);

        // Người ngoài ca thấy ca đã đầy vì B bị khóa không còn tính chỗ.
        $d = $this->nguoiDung('3', 'nhanvien-d');
        $this->dangNhap($d);
        $this->getJson('/api/dang-ky-ca/tuan-sau')
            ->assertOk()
            ->assertJsonPath('da_ky.0.con_cho', false)
            ->assertJsonPath('da_ky.0.ly_do_khoa', 'du_nhan_vien');

        $ql = $this->nguoiDung('2', 'quanly-a');
        $this->dangNhap($ql);
        $res = $this->getJson('/api/lich-lam-viec?tu_ngay=' . $this->thuHai)->assertOk();
        $ten = collect($res->json('data'))->pluck('HoTen');
        $this->assertTrue($ten->contains('nhanvien-a'));
        $this->assertTrue($ten->contains('nhanvien-c'));
        $this->assertFalse($ten->contains('nhanvien-b'));
    }
}

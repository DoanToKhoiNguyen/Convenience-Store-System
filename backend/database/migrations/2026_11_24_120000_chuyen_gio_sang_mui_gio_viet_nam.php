<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Trước đây config/app.php hard-code UTC nên mọi thời điểm được ghi theo giờ UTC,
    // trong khi .env đã khai APP_TIMEZONE=Asia/Ho_Chi_Minh. Cộng thêm 7 giờ cho dữ liệu cũ
    // để lịch sử hiển thị đúng giờ Việt Nam sau khi sửa config.
    private const GIO_LECH = 7;

    private const COT_THOI_GIAN = [
        'phieu_nhap'          => ['NgayLap', 'NgayDuyet', 'NgayNhan', 'created_at', 'updated_at'],
        'chi_tiet_phieu_nhap' => ['created_at', 'updated_at'],
        'hoa_don'             => ['NgayLap', 'HanThanhToan', 'NgayThanhToan', 'created_at', 'updated_at'],
        'chi_tiet_hoa_don'    => ['created_at', 'updated_at'],
        'hoa_don_lo'          => ['created_at', 'updated_at'],
        'lo_hang'             => ['NgayNhap', 'created_at', 'updated_at'],
        'lo_hang_da_loai'     => ['ThoiGianLoai', 'created_at', 'updated_at'],
        'cap_nhat_ton_kho'    => ['ThoiGianCapNhat', 'created_at', 'updated_at'],
        'khuyen_mai'          => ['NgayBatDau', 'NgayKetThuc', 'created_at', 'updated_at'],
        'san_pham'            => ['created_at', 'updated_at'],
        'nha_cung_cap'        => ['created_at', 'updated_at'],
        'danh_muc'            => ['created_at', 'updated_at'],
        'tai__khoan'          => ['created_at', 'updated_at'],
        'vai_tro'             => ['created_at', 'updated_at'],
        'tai_khoan_vai_tro'   => ['created_at', 'updated_at'],
        'quyen'               => ['created_at', 'updated_at'],
        'phan_cong'           => ['created_at', 'updated_at'],
        'lich_dang_ky'        => ['created_at', 'updated_at'],
        'ca_lam_viec'         => ['created_at', 'updated_at'],
    ];

    public function up(): void
    {
        $this->doiGio(self::GIO_LECH);
    }

    public function down(): void
    {
        $this->doiGio(-self::GIO_LECH);
    }

    private function doiGio(int $gio): void
    {
        foreach (self::COT_THOI_GIAN as $bang => $cots) {
            foreach ($cots as $cot) {
                DB::table($bang)->whereNotNull($cot)->update([
                    $cot => DB::raw($this->bieuThuc($cot, $gio)),
                ]);
            }
        }
    }

    private function bieuThuc(string $cot, int $gio): string
    {
        $khoang = ($gio >= 0 ? '+' : '') . $gio . ' hours';

        return match (DB::getDriverName()) {
            'pgsql'  => "\"{$cot}\" + interval '{$khoang}'",
            'sqlite' => "datetime(\"{$cot}\", '{$khoang}')",
            default  => "DATE_ADD(\"{$cot}\", INTERVAL {$gio} HOUR)",
        };
    }
};

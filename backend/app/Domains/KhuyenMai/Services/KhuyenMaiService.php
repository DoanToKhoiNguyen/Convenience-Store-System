<?php

namespace App\Domains\KhuyenMai\Services;

use App\Models\HoaDon;
use App\Models\KhuyenMai;

class KhuyenMaiService
{
    /** Số tiền giảm của một chương trình trên tiền hàng. Luôn làm tròn xuống đồng, không vượt tiền hàng. */
    public function tinhGiam(KhuyenMai $km, float $tienHang): float
    {
        if ($tienHang <= 0) {
            return 0.0;
        }

        if ($km->LoaiGiam === 'so_tien') {
            $giam = (float) $km->GiaTriGiam;
        } else {
            $giam = $tienHang * (float) $km->GiaTriGiam / 100;
            if ((float) $km->GiamToiDa > 0) {
                $giam = min($giam, (float) $km->GiamToiDa);
            }
        }

        return (float) max(0, min(floor(round($giam, 2)), $tienHang));
    }

    /** Chọn một chương trình đang chạy, đủ điều kiện và giảm nhiều nhất (không cộng dồn). */
    public function timTotNhat(float $tienHang): array
    {
        $tot = null;
        $giamTot = 0.0;

        $ds = KhuyenMai::dangChay()->where('DieuKienApDung', '<=', $tienHang)->get();
        foreach ($ds as $km) {
            $giam = $this->tinhGiam($km, $tienHang);
            if ($giam > $giamTot) {
                $tot = $km;
                $giamTot = $giam;
            }
        }

        return ['km' => $tot, 'giam' => $giamTot];
    }

    /** Tính lại giảm giá cho hóa đơn nháp. Chỉ gọi khi thêm món, không gọi lúc thanh toán. */
    public function apDungChoHoaDon(HoaDon $hoaDon): void
    {
        $tienHang = (float) $hoaDon->TongTienHang;
        ['km' => $km, 'giam' => $giam] = $this->timTotNhat($tienHang);

        $hoaDon->MaKhuyenMai = $km?->MaKhuyenMai;
        $hoaDon->TienGiamGia = $giam;
        $hoaDon->TongTien = $tienHang - $giam;
    }
}
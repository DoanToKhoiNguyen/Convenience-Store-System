<?php

namespace App\Domains\BanHang\Services;

use App\Models\CapNhatTonKho;
use App\Models\ChiTietHoaDon;
use App\Models\HoaDon;
use App\Models\SanPham;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HoaDonService
{
    public const PHUT_GIU_HANG = 60;

    /** Đưa vào hàng đợi: trừ kho để giữ hàng, hạn thanh toán sau 1 giờ. */
    public function giuHang(int $maHD, int $maTaiKhoan): HoaDon
    {
        return DB::transaction(function () use ($maHD, $maTaiKhoan) {
            $hoaDon = $this->khoa($maHD);
            $this->phaiChuaThanhToan($hoaDon);

            if ($hoaDon->DaGiuHang) {
                throw new \DomainException('Hóa đơn này đã nằm trong hàng đợi.', 400);
            }

            $chiTiet = $this->chiTiet($hoaDon);
            $this->truKho($chiTiet, "Giữ hàng cho hóa đơn #{$hoaDon->MaHoaDon}", $maTaiKhoan);

            $hoaDon->DaGiuHang = true;
            $hoaDon->HanThanhToan = now()->addMinutes(self::PHUT_GIU_HANG);
            $hoaDon->save();

            return $hoaDon->load('chiTietHoaDon');
        });
    }

    public function thanhToan(int $maHD, int $maTaiKhoan, array $thongTin): HoaDon
    {
        return DB::transaction(function () use ($maHD, $maTaiKhoan, $thongTin) {
            $hoaDon = $this->khoa($maHD);
            $this->phaiChuaThanhToan($hoaDon);
            $chiTiet = $this->chiTiet($hoaDon);

            if ($hoaDon->DaGiuHang) {
                // Hàng đã được giữ từ trước nên không trừ kho lần nữa
                if ($hoaDon->HanThanhToan && $hoaDon->HanThanhToan->isPast()) {
                    throw new \DomainException(
                        'Hóa đơn đã quá hạn thanh toán, hệ thống sẽ tự hủy và hoàn lại kho.', 422
                    );
                }
            } else {
                $this->truKho($chiTiet, "Bán hàng - hóa đơn #{$hoaDon->MaHoaDon}", $maTaiKhoan);
            }

            $hoaDon->TrangThaiHoaDon = true;
            $hoaDon->DaGiuHang = false;
            $hoaDon->HanThanhToan = null;
            $hoaDon->NgayThanhToan = now();
            $hoaDon->MaGiaoDich = $thongTin['maGiaoDich'] ?? null;
            $hoaDon->TenGiaoDich = $thongTin['tenGiaoDich'] ?? null;
            #$hoaDon->TienGiamGia = $thongTin['tienGiamGia'] ?? 0;
            $hoaDon->save();

            return $hoaDon->load('chiTietHoaDon');
        });
    }

    /** Hủy hóa đơn chưa thanh toán (thủ công). Nếu đang giữ hàng thì hoàn kho. */
    public function huy(int $maHD, string $lyDo, int $maTaiKhoan): HoaDon
    {
        return DB::transaction(function () use ($maHD, $lyDo, $maTaiKhoan) {
            $hoaDon = $this->khoa($maHD);
            $this->phaiChuaThanhToan($hoaDon);
            $this->huyVaHoanKho($hoaDon, $lyDo, $maTaiKhoan);

            return $hoaDon;
        });
    }

    /** Hủy mọi hóa đơn trong hàng đợi đã quá hạn. Trả về số hóa đơn đã hủy. */
    public function huyQuaHan(): int
    {
        $ids = HoaDon::where('DaHuy', false)
            ->where('TrangThaiHoaDon', false)
            ->where('DaGiuHang', true)
            ->where('HanThanhToan', '<=', now())
            ->pluck('MaHoaDon');

        $dem = 0;
        foreach ($ids as $id) {
            try {
                $daHuy = DB::transaction(function () use ($id) {
                    $hoaDon = $this->khoa((int) $id);

                    // Kiểm tra lại sau khi khóa: có thể vừa được thanh toán hoặc hủy
                    if ($hoaDon->DaHuy || $hoaDon->TrangThaiHoaDon || !$hoaDon->DaGiuHang
                        || !$hoaDon->HanThanhToan || $hoaDon->HanThanhToan->isFuture()) {
                        return false;
                    }

                    $this->huyVaHoanKho(
                        $hoaDon,
                        'Quá hạn thanh toán (tự động hủy sau 1 giờ)',
                        (int) $hoaDon->MaTaiKhoan
                    );

                    return true;
                });

                if ($daHuy) {
                    $dem++;
                }
            } catch (\Throwable $e) {
                Log::error("Không hủy được hóa đơn quá hạn #{$id}: " . $e->getMessage());
            }
        }

        return $dem;
    }

    /** Xóa hóa đơn nháp bị bỏ dở quá 1 ngày (chưa trừ kho nên không cần hoàn kho). */
    public function donNhapCu(): int
    {
        return DB::transaction(function () {
            $ids = HoaDon::where('DaHuy', false)
                ->where('TrangThaiHoaDon', false)
                ->where('DaGiuHang', false)
                ->where('NgayLap', '<', now()->subDay())
                ->lockForUpdate()
                ->pluck('MaHoaDon');

            if ($ids->isEmpty()) {
                return 0;
            }

            ChiTietHoaDon::whereIn('MaHoaDon', $ids)->delete();
            HoaDon::whereIn('MaHoaDon', $ids)->delete();

            return $ids->count();
        });
    }

    // ---------------------------------------------------------------

    private function khoa(int $maHD): HoaDon
    {
        $hoaDon = HoaDon::where('MaHoaDon', $maHD)->lockForUpdate()->first();
        if (!$hoaDon) {
            throw new \DomainException('Không tìm thấy hóa đơn.', 404);
        }

        return $hoaDon;
    }

    private function phaiChuaThanhToan(HoaDon $hoaDon): void
    {
        if ($hoaDon->DaHuy) {
            throw new \DomainException('Hóa đơn đã bị hủy.', 400);
        }
        if ($hoaDon->TrangThaiHoaDon) {
            throw new \DomainException('Hóa đơn này đã được thanh toán.', 400);
        }
    }

    private function chiTiet(HoaDon $hoaDon)
    {
        // Sắp xếp theo mã sản phẩm để các giao dịch đồng thời khóa theo cùng thứ tự (tránh deadlock)
        $chiTiet = ChiTietHoaDon::where('MaHoaDon', $hoaDon->MaHoaDon)->orderBy('MaSanPham')->get();
        if ($chiTiet->isEmpty()) {
            throw new \DomainException('Hóa đơn chưa có sản phẩm nào.', 400);
        }

        return $chiTiet;
    }

    private function truKho($chiTiet, string $lyDo, int $maTaiKhoan): void
    {
        foreach ($chiTiet as $ct) {
            $sp = SanPham::where('MaSanPham', $ct->MaSanPham)->lockForUpdate()->first();

            if (!$sp || $sp->SoLuongHienTai < $ct->SoLuong) {
                $ten = $sp->TenSanPham ?? $ct->TenSanPham;
                throw new \DomainException("Sản phẩm '{$ten}' không đủ số lượng trong kho.", 400);
            }

            $this->doiTonKho($sp, -$ct->SoLuong, $lyDo, $maTaiKhoan);
        }
    }

    private function huyVaHoanKho(HoaDon $hoaDon, string $lyDo, int $maTaiKhoan): void
    {
        if ($hoaDon->DaGiuHang) {
            $chiTiet = ChiTietHoaDon::where('MaHoaDon', $hoaDon->MaHoaDon)->orderBy('MaSanPham')->get();

            foreach ($chiTiet as $ct) {
                $sp = SanPham::where('MaSanPham', $ct->MaSanPham)->lockForUpdate()->first();
                if ($sp) {
                    $this->doiTonKho(
                        $sp,
                        (int) $ct->SoLuong,
                        "Hoàn kho - hủy hóa đơn #{$hoaDon->MaHoaDon}: {$lyDo}",
                        $maTaiKhoan
                    );
                }
            }
        }

        $hoaDon->DaHuy = true;
        $hoaDon->DaGiuHang = false;
        $hoaDon->HanThanhToan = null;
        $hoaDon->LyDoHuy = $lyDo;
        $hoaDon->save();
    }

    /** Đổi tồn kho và ghi lịch sử (SoLuongHienTai = số cũ, SoLuongMoi = số mới, theo cách bạn đang ghi). */
    private function doiTonKho(SanPham $sp, int $delta, string $lyDo, int $maTaiKhoan): void
    {
        $truoc = (int) $sp->SoLuongHienTai;
        $sp->SoLuongHienTai = $truoc + $delta;
        $sp->save();

        CapNhatTonKho::create([
            'ThoiGianCapNhat' => now(),
            'SoLuongMoi'      => $sp->SoLuongHienTai,
            'SoLuongHienTai'  => $truoc,
            'LyDoCapNhat'     => $lyDo,
            'MaTaiKhoan'      => $maTaiKhoan,
            'MaSanPham'       => $sp->MaSanPham,
        ]);
    }
}
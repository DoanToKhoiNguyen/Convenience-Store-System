<?php

namespace App\Domains\LoHang\Services;

use App\Models\CapNhatTonKho;
use App\Models\HoaDonLo;
use App\Models\LoHang;
use App\Models\SanPham;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Mọi thay đổi tồn kho đều đi qua đây để SoLuongHienTai luôn bằng tổng SoLuongCon của các lô.
 * Các hàm public phải được gọi bên trong DB::transaction.
 */
class LoHangService
{
    /** Tiền tố gợi ý từ tên sản phẩm: chữ cái đầu của các từ (bỏ dấu), tối đa 3 ký tự, không trùng. */
    public function goiYTienTo(string $ten, ?int $boQua = null): string
    {
        $goc = '';
        foreach (preg_split('/[^A-Za-z0-9]+/', Str::ascii($ten), -1, PREG_SPLIT_NO_EMPTY) as $tu) {
            $goc .= strtoupper($tu[0]);
            if (strlen($goc) >= 3) {
                break;
            }
        }
        $goc = $goc !== '' ? $goc : 'SP';

        $tienTo = $goc;
        $i = 2;
        while (SanPham::where('TienToLo', $tienTo)
            ->when($boQua, fn ($q) => $q->where('MaSanPham', '<>', $boQua))
            ->exists()) {
            $tienTo = $goc . $i++;
        }

        return $tienTo;
    }

    /** Nhập hàng: tạo lô mới, tăng tồn kho, ghi lịch sử. */
    public function nhapLo(
        int $maSanPham,
        int $soLuong,
        ?string $han,
        string $lyDo,
        int $maTaiKhoan,
        ?int $maPhieu = null,
        ?int $maChiTiet = null,
    ): LoHang {
        if ($soLuong <= 0) {
            throw new \DomainException('Số lượng nhập phải lớn hơn 0.', 422);
        }

        $sp = $this->khoaSanPham($maSanPham);
        $lo = $this->taoLoNoiBo($sp, $soLuong, $han, $maPhieu, $maChiTiet);
        $this->ghiTon($sp, $soLuong, "{$lyDo} (lô {$lo->MaLo})", $maTaiKhoan);

        return $lo;
    }

    /**
     * Bán hàng: trừ từ lô có hạn gần nhất trước, bỏ qua lô đã hết hạn.
     * Trả về [['MaLoHang' => .., 'MaLo' => .., 'SoLuong' => ..], ...].
     */
    public function xuatBan(int $maSanPham, int $soLuong, string $lyDo, int $maTaiKhoan): array
    {
        $sp = $this->khoaSanPham($maSanPham);
        $chia = $this->rutTuCacLo($sp, $soLuong, true);

        $chiTiet = collect($chia)->map(fn ($c) => "{$c['MaLo']}×{$c['SoLuong']}")->implode(', ');
        $this->ghiTon($sp, -$soLuong, "{$lyDo} [{$chiTiet}]", $maTaiKhoan);

        return $chia;
    }

    /** Hoàn kho khi hủy hóa đơn đang giữ hàng: trả đúng về các lô đã trừ. */
    public function hoanBan(int $maChiTietHoaDon, int $maSanPham, int $soLuong, string $lyDo, int $maTaiKhoan): void
    {
        $sp = $this->khoaSanPham($maSanPham);

        $daHoan = 0;
        foreach (HoaDonLo::where('MaChiTietHoaDon', $maChiTietHoaDon)->orderBy('MaLoHang')->get() as $d) {
            $lo = LoHang::where('MaLoHang', $d->MaLoHang)->lockForUpdate()->first();
            if ($lo) {
                $lo->SoLuongCon = (int) $lo->SoLuongCon + (int) $d->SoLuong;
                $lo->save();
                $daHoan += (int) $d->SoLuong;
            }
        }

        $thieu = $soLuong - $daHoan;
        if ($thieu > 0) {
            // Hóa đơn giữ hàng từ trước khi có lô: hoàn vào lô mới nhất
            $lo = $this->loMoiNhat($maSanPham);
            if ($lo) {
                $lo->SoLuongCon = (int) $lo->SoLuongCon + $thieu;
                $lo->save();
            } else {
                $this->taoLoNoiBo($sp, $thieu, null, null, null);
            }
        }

        HoaDonLo::where('MaChiTietHoaDon', $maChiTietHoaDon)->delete();
        $this->ghiTon($sp, $soLuong, $lyDo, $maTaiKhoan);
    }

    /**
     * Cập nhật tồn kho thủ công.
     * - Có chọn lô: thay đổi áp dụng cho lô đó.
     * - Không chọn, giảm: trừ lô có hạn gần nhất trước (kể cả lô đã hết hạn).
     * - Không chọn, tăng: cộng vào lô mới nhất.
     */
    public function capNhatThuCong(int $maSanPham, int $soLuongMoi, ?int $maLo, string $lyDo, int $maTaiKhoan): SanPham
    {
        $sp = $this->khoaSanPham($maSanPham);
        $delta = $soLuongMoi - (int) $sp->SoLuongHienTai;

        if ($delta === 0) {
            throw new \DomainException('Số lượng mới đang bằng số lượng hiện tại.', 422);
        }
        if ($sp->TonKhoToiDa && $soLuongMoi > $sp->TonKhoToiDa) {
            throw new \DomainException("Số lượng tồn kho vượt quá mức tối đa cho phép ({$sp->TonKhoToiDa}).", 422);
        }

        if ($maLo) {
            $lo = LoHang::where('MaLoHang', $maLo)->where('MaSanPham', $maSanPham)->lockForUpdate()->first();
            if (!$lo) {
                throw new \DomainException('Lô hàng không thuộc sản phẩm này.', 422);
            }
            if ((int) $lo->SoLuongCon + $delta < 0) {
                $giam = -$delta;
                throw new \DomainException("Lô {$lo->MaLo} chỉ còn {$lo->SoLuongCon}, không thể giảm {$giam}.", 422);
            }
            $lo->SoLuongCon = (int) $lo->SoLuongCon + $delta;
            $lo->save();
            $lyDo .= " (lô {$lo->MaLo})";
        } elseif ($delta > 0) {
            $lo = $this->loMoiNhat($maSanPham);
            if ($lo) {
                $lo->SoLuongCon = (int) $lo->SoLuongCon + $delta;
                $lo->save();
                $lyDo .= " (lô {$lo->MaLo})";
            } else {
                $this->taoLoNoiBo($sp, $delta, null, null, null);
            }
        } else {
            $this->rutTuCacLo($sp, -$delta, false);
        }

        $this->ghiTon($sp, $delta, $lyDo, $maTaiKhoan);

        return $sp;
    }

    /** Hủy cả lô (hàng hết hạn, hỏng): đưa số còn lại về 0 và trừ khỏi tồn kho. */
    public function huyLo(int $maLo, string $lyDo, int $maTaiKhoan): LoHang
    {
        $tam = LoHang::find($maLo);
        if (!$tam) {
            throw new \DomainException('Không tìm thấy lô hàng.', 404);
        }

        $sp = $this->khoaSanPham((int) $tam->MaSanPham); // khóa sản phẩm trước, lô sau (cùng thứ tự với các hàm khác)
        $lo = LoHang::where('MaLoHang', $maLo)->lockForUpdate()->first();

        $soLuong = (int) $lo->SoLuongCon;
        if ($soLuong <= 0) {
            throw new \DomainException('Lô này đã hết hàng, không còn gì để hủy.', 422);
        }

        $lo->SoLuongCon = 0;
        $lo->save();
        $this->ghiTon($sp, -$soLuong, "Hủy lô {$lo->MaLo}: {$lyDo}", $maTaiKhoan);

        return $lo;
    }

    public function datHanSuDung(int $maLo, ?string $han): LoHang
    {
        $lo = LoHang::find($maLo);
        if (!$lo) {
            throw new \DomainException('Không tìm thấy lô hàng.', 404);
        }

        $lo->HanSuDung = $han ?: null;
        $lo->save();

        return $lo;
    }

    /** Mô tả một lô kèm số ngày còn lại và tình trạng hạn dùng. */
    public function moTa(LoHang $lo, int $nguong): array
    {
        $soNgay = null;
        $tinhTrang = 'khong_han';

        if ($lo->HanSuDung) {
            $han = Carbon::parse($lo->HanSuDung->toDateString())->startOfDay();
            $soNgay = (int) Carbon::today()->diffInDays($han, false); // âm = đã quá hạn
            $tinhTrang = $soNgay < 0 ? 'het_han' : ($soNgay <= $nguong ? 'sap_het_han' : 'binh_thuong');
        }

        return [
            'MaLoHang'        => (int) $lo->MaLoHang,
            'MaLo'            => $lo->MaLo,
            'MaSanPham'       => (int) $lo->MaSanPham,
            'NgayNhap'        => $lo->NgayNhap?->toDateString(),
            'HanSuDung'       => $lo->HanSuDung?->toDateString(),
            'SoLuongNhap'     => (int) $lo->SoLuongNhap,
            'SoLuongCon'      => (int) $lo->SoLuongCon,
            'so_ngay_con_lai' => $soNgay,
            'trang_thai'      => $tinhTrang,
        ];
    }

    /** Thêm thông tin lô và hạn dùng vào một sản phẩm (đã nạp quan hệ loHang, sắp theo hạn gần nhất). */
    public function kemThongTinHsd(SanPham $sp): array
    {
        $nguong = (int) ($sp->CanhBaoHSD ?? 0);
        $los = $sp->relationLoaded('loHang') ? $sp->loHang : collect();
        $mo = $los->map(fn ($lo) => $this->moTa($lo, $nguong))->values();

        // Các lô đã sắp theo hạn tăng dần nên lô có hạn đầu tiên cũng là lô "xấu" nhất
        $dauTien = $mo->first(fn ($l) => $l['HanSuDung'] !== null);

        return array_merge($sp->toArray(), [
            'lo_hang'          => $mo->all(),
            'han_gan_nhat'     => $dauTien['HanSuDung'] ?? null,
            'so_ngay_hsd'      => $dauTien['so_ngay_con_lai'] ?? null,
            'trang_thai_hsd'   => $dauTien['trang_thai'] ?? 'khong_han',
            'SoLuongBanDuoc'   => (int) $mo->filter(fn ($l) => $l['trang_thai'] !== 'het_han')->sum('SoLuongCon'),
            'so_luong_het_han' => (int) $mo->where('trang_thai', 'het_han')->sum('SoLuongCon'),
        ]);
    }

    /** Tạo lô "tồn đầu kỳ" cho sản phẩm mà tồn kho lớn hơn tổng các lô (dùng sau khi seed). */
    public function dongBoTatCa(): array
    {
        $tao = 0;
        $lech = [];

        foreach (SanPham::orderBy('MaSanPham')->pluck('MaSanPham') as $ma) {
            DB::transaction(function () use ($ma, &$tao, &$lech) {
                $sp = $this->khoaSanPham((int) $ma);
                $tong = (int) LoHang::where('MaSanPham', $ma)->sum('SoLuongCon');
                $ton = (int) $sp->SoLuongHienTai;

                if ($ton > $tong) {
                    $this->taoLoNoiBo($sp, $ton - $tong, null, null, null);
                    $tao++;
                } elseif ($ton < $tong) {
                    $lech[] = "{$sp->TenSanPham}: tồn kho {$ton} nhưng tổng các lô là {$tong}";
                }
            });
        }

        return ['tao' => $tao, 'lech' => $lech];
    }

    // ------------------------------------------------------------------

    private function khoaSanPham(int $ma): SanPham
    {
        $sp = SanPham::where('MaSanPham', $ma)->lockForUpdate()->first();
        if (!$sp) {
            throw new \DomainException('Không tìm thấy sản phẩm.', 404);
        }

        return $sp;
    }

    private function loMoiNhat(int $maSanPham): ?LoHang
    {
        return LoHang::where('MaSanPham', $maSanPham)->orderByDesc('MaLoHang')->lockForUpdate()->first();
    }

    private function taoLoNoiBo(SanPham $sp, int $soLuong, ?string $han, ?int $maPhieu, ?int $maChiTiet): LoHang
    {
        return LoHang::create([
            'MaLo'               => $this->sinhMaLo($sp),
            'MaSanPham'          => $sp->MaSanPham,
            'MaPhieuNhap'        => $maPhieu,
            'MaChiTietPhieuNhap' => $maChiTiet,
            'NgayNhap'           => now(),
            'HanSuDung'          => $han ?: null,
            'SoLuongNhap'        => $soLuong,
            'SoLuongCon'         => $soLuong,
        ]);
    }

    private function sinhMaLo(SanPham $sp): string
    {
        if (!$sp->TienToLo) {
            $sp->TienToLo = $this->goiYTienTo($sp->TenSanPham, (int) $sp->MaSanPham);
        }
        $sp->SoLoCuoi = (int) $sp->SoLoCuoi + 1;
        $sp->save();

        return $sp->TienToLo . '-' . str_pad((string) $sp->SoLoCuoi, 3, '0', STR_PAD_LEFT);
    }

    /** Rút số lượng từ các lô theo thứ tự hạn gần nhất trước (lô không hạn xếp cuối). */
    private function rutTuCacLo(SanPham $sp, int $soLuong, bool $chiConHan): array
    {
        $q = LoHang::where('MaSanPham', $sp->MaSanPham)->where('SoLuongCon', '>', 0);
        if ($chiConHan) {
            $q->where(fn ($w) => $w->whereNull('HanSuDung')
                ->orWhere('HanSuDung', '>=', Carbon::today()->toDateString()));
        }

        $los = $q->orderByRaw('"HanSuDung" IS NULL')
            ->orderBy('HanSuDung')
            ->orderBy('MaLoHang')
            ->lockForUpdate()
            ->get();

        $co = (int) $los->sum('SoLuongCon');
        if ($co < $soLuong) {
            if ($chiConHan) {
                $thongBao = (int) $sp->SoLuongHienTai >= $soLuong
                    ? "Sản phẩm '{$sp->TenSanPham}' chỉ còn {$co} sản phẩm còn hạn sử dụng (phần còn lại đã hết hạn)."
                    : "Sản phẩm '{$sp->TenSanPham}' không đủ số lượng trong kho.";
            } else {
                $thongBao = "Tổng số lượng các lô ({$co}) không đủ để giảm {$soLuong}. Hãy chạy lệnh đồng bộ lô hàng.";
            }
            throw new \DomainException($thongBao, 400);
        }

        $con = $soLuong;
        $chia = [];
        foreach ($los as $lo) {
            if ($con <= 0) {
                break;
            }
            $lay = min($con, (int) $lo->SoLuongCon);
            $lo->SoLuongCon = (int) $lo->SoLuongCon - $lay;
            $lo->save();
            $chia[] = ['MaLoHang' => (int) $lo->MaLoHang, 'MaLo' => $lo->MaLo, 'SoLuong' => $lay];
            $con -= $lay;
        }

        return $chia;
    }

    private function ghiTon(SanPham $sp, int $delta, string $lyDo, int $maTaiKhoan): void
    {
        $truoc = (int) $sp->SoLuongHienTai;
        $sp->SoLuongHienTai = $truoc + $delta;
        $sp->save();

        CapNhatTonKho::create([
            'ThoiGianCapNhat' => now(),
            'SoLuongMoi'      => $sp->SoLuongHienTai,
            'SoLuongHienTai'  => $truoc,
            'LyDoCapNhat'     => Str::limit($lyDo, 250, ''),
            'MaTaiKhoan'      => $maTaiKhoan,
            'MaSanPham'       => $sp->MaSanPham,
        ]);
    }
}
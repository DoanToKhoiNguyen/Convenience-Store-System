<?php

namespace App\Domains\BaoCao\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BaoCaoController extends Controller
{
    public function doanhThu(Request $request): JsonResponse
    {
        $request->validate([
            'tu_ngay'  => 'required|date_format:Y-m-d',
            'den_ngay' => 'required|date_format:Y-m-d|after_or_equal:tu_ngay',
            'nhom'     => 'nullable|in:gio,ngay,thang',
        ]);

        // Chỉ chủ doanh nghiệp (vai trò 1) được xem giá vốn và lợi nhuận
        $laChu = (int) $request->user()->MaVaiTro === 1;

        $tu  = Carbon::parse($request->input('tu_ngay'))->startOfDay();
        $den = Carbon::parse($request->input('den_ngay'))->startOfDay();
        $soNgay = (int) $tu->diffInDays($den, true) + 1;

        if ($soNgay > 1830) {
            return response()->json(['message' => 'Chỉ xem được tối đa 5 năm mỗi lần.'], 422);
        }

        // Cách nhóm biểu đồ: 1 ngày theo giờ, còn lại theo ngày hoặc tháng
        $nhom = $request->input('nhom');
        if ($soNgay === 1) {
            $nhom = 'gio';
        } elseif (!in_array($nhom, ['ngay', 'thang'], true)) {
            $nhom = $soNgay <= 62 ? 'ngay' : 'thang';
        } elseif ($nhom === 'ngay' && $soNgay > 400) {
            $nhom = 'thang';
        }

        $denTruoc = $den->copy()->addDay();            // mốc kết thúc (không bao gồm)
        $kyTruocTu = $tu->copy()->subDays($soNgay);    // kỳ trước: cùng số ngày, liền kề phía trước

        $out = [
            'ky'       => ['tu_ngay' => $tu->toDateString(), 'den_ngay' => $den->toDateString(), 'nhom' => $nhom],
            'ky_truoc' => [
                'tu_ngay'  => $kyTruocTu->toDateString(),
                'den_ngay' => $tu->copy()->subDay()->toDateString(),
            ],
            'quyen'          => ['xem_loi_nhuan' => $laChu],
            'tong_hop'       => $this->tongHop($tu, $denTruoc, $laChu),
            'tong_hop_truoc' => $this->tongHop($kyTruocTu, $tu, $laChu),
            'chuoi'          => $this->chuoi($tu, $den, $denTruoc, $nhom, $laChu),
            'phuong_thuc'    => $this->phuongThuc($tu, $denTruoc),
            'nhan_vien'      => $this->nhanVien($tu, $denTruoc),
            'dang_cho'       => $this->dangCho(),
        ];

        [$banChay, $sinhLoi] = $this->sanPhamBan($tu, $denTruoc, $laChu);
        $out['ban_chay'] = $banChay;
        if ($laChu) {
            $out['sinh_loi'] = $sinhLoi;
        }
        $out['ban_cham'] = $this->banCham($tu, $denTruoc, $laChu);

        return response()->json($out);
    }

    /** Chỉ lấy hóa đơn đã thanh toán, chưa hủy, theo NGÀY THANH TOÁN. Bảng hoa_don phải có alias "hd". */
    private function hoaDonHopLe($query, Carbon $tu, Carbon $denTruoc)
    {
        return $query->where('hd.DaHuy', false)
            ->where('hd.TrangThaiHoaDon', true)
            ->whereNotNull('hd.NgayThanhToan')
            ->where('hd.NgayThanhToan', '>=', $tu)
            ->where('hd.NgayThanhToan', '<', $denTruoc);
    }

    private function chiTietHopLe(Carbon $tu, Carbon $denTruoc)
    {
        return $this->hoaDonHopLe(
            DB::table('chi_tiet_hoa_don as ct')->join('hoa_don as hd', 'hd.MaHoaDon', '=', 'ct.MaHoaDon'),
            $tu,
            $denTruoc
        );
    }

    private function tongHop(Carbon $tu, Carbon $denTruoc, bool $laChu): array
    {
        $r = $this->hoaDonHopLe(DB::table('hoa_don as hd'), $tu, $denTruoc)
            ->selectRaw('COUNT(*) as so_hoa_don,
                         COALESCE(SUM(hd."TongTien"), 0) as doanh_thu,
                         COALESCE(SUM(hd."TienGiamGia"), 0) as giam_gia')
            ->first();

        $kq = [
            'so_hoa_don' => (int) $r->so_hoa_don,
            'doanh_thu'  => (float) $r->doanh_thu,
            'giam_gia'   => (float) $r->giam_gia,
        ];
        $kq['trung_binh'] = $kq['so_hoa_don'] > 0 ? round($kq['doanh_thu'] / $kq['so_hoa_don']) : 0;

        if ($laChu) {
            $gv = $this->chiTietHopLe($tu, $denTruoc)
                ->selectRaw('COALESCE(SUM(ct."SoLuong" * ct."GiaVon"), 0) as gia_von')
                ->first();

            $kq['gia_von'] = (float) $gv->gia_von;
            $kq['loi_nhuan'] = $kq['doanh_thu'] - $kq['gia_von'];
            $kq['bien_loi_nhuan'] = $kq['doanh_thu'] > 0
                ? round($kq['loi_nhuan'] / $kq['doanh_thu'] * 100, 1)
                : 0;
        }

        return $kq;
    }

    private function chuoi(Carbon $tu, Carbon $den, Carbon $denTruoc, string $nhom, bool $laChu): array
    {
        $expr = match ($nhom) {
            'gio'   => "to_char(hd.\"NgayThanhToan\", 'HH24')",
            'thang' => "to_char(hd.\"NgayThanhToan\", 'YYYY-MM')",
            default => "to_char(hd.\"NgayThanhToan\", 'YYYY-MM-DD')",
        };

        $doanhThu = $this->hoaDonHopLe(DB::table('hoa_don as hd'), $tu, $denTruoc)
            ->selectRaw("$expr as k, COUNT(*) as so_hoa_don, COALESCE(SUM(hd.\"TongTien\"), 0) as doanh_thu")
            ->groupByRaw($expr)
            ->get()
            ->keyBy('k');

        $giaVon = collect();
        if ($laChu) {
            $giaVon = $this->chiTietHopLe($tu, $denTruoc)
                ->selectRaw("$expr as k, COALESCE(SUM(ct.\"SoLuong\" * ct.\"GiaVon\"), 0) as gia_von")
                ->groupByRaw($expr)
                ->get()
                ->keyBy('k');
        }

        // Điền đủ các mốc (kể cả mốc không có hóa đơn) để biểu đồ liên tục
        $keys = [];
        if ($nhom === 'gio') {
            for ($h = 0; $h < 24; $h++) {
                $keys[] = sprintf('%02d', $h);
            }
        } elseif ($nhom === 'ngay') {
            for ($d = $tu->copy(); $d->lte($den); $d->addDay()) {
                $keys[] = $d->format('Y-m-d');
            }
        } else {
            for ($d = $tu->copy()->startOfMonth(); $d->lte($den); $d->addMonth()) {
                $keys[] = $d->format('Y-m');
            }
        }

        $chuoi = [];
        foreach ($keys as $k) {
            $dt = $doanhThu->get($k);
            $diem = [
                'k'          => $k,
                'nhan'       => match ($nhom) {
                    'gio'   => $k . 'h',
                    'thang' => substr($k, 5, 2) . '/' . substr($k, 0, 4),
                    default => substr($k, 8, 2) . '/' . substr($k, 5, 2),
                },
                'doanh_thu'  => (float) ($dt->doanh_thu ?? 0),
                'so_hoa_don' => (int) ($dt->so_hoa_don ?? 0),
            ];
            if ($laChu) {
                $diem['loi_nhuan'] = $diem['doanh_thu'] - (float) ($giaVon->get($k)->gia_von ?? 0);
            }
            $chuoi[] = $diem;
        }

        return $chuoi;
    }

    private function phuongThuc(Carbon $tu, Carbon $denTruoc): array
    {
        $ten = "COALESCE(hd.\"TenGiaoDich\", 'Khác')";

        return $this->hoaDonHopLe(DB::table('hoa_don as hd'), $tu, $denTruoc)
            ->selectRaw("$ten as ten, COUNT(*) as so_hoa_don, COALESCE(SUM(hd.\"TongTien\"), 0) as doanh_thu")
            ->groupByRaw($ten)
            ->orderByDesc('doanh_thu')
            ->get()
            ->map(fn ($r) => [
                'ten'        => $r->ten,
                'so_hoa_don' => (int) $r->so_hoa_don,
                'doanh_thu'  => (float) $r->doanh_thu,
            ])
            ->all();
    }

    private function nhanVien(Carbon $tu, Carbon $denTruoc): array
    {
        return $this->hoaDonHopLe(
            DB::table('hoa_don as hd')->join('tai__khoan as tk', 'tk.MaTaiKhoan', '=', 'hd.MaTaiKhoan'),
            $tu,
            $denTruoc
        )
            ->selectRaw('tk."MaTaiKhoan", tk."HoTen", COUNT(*) as so_hoa_don, COALESCE(SUM(hd."TongTien"), 0) as doanh_thu')
            ->groupBy('tk.MaTaiKhoan', 'tk.HoTen')
            ->orderByDesc('doanh_thu')
            ->limit(20)
            ->get()
            ->map(fn ($r) => [
                'MaTaiKhoan' => (int) $r->MaTaiKhoan,
                'HoTen'      => $r->HoTen,
                'so_hoa_don' => (int) $r->so_hoa_don,
                'doanh_thu'  => (float) $r->doanh_thu,
            ])
            ->all();
    }

    /** Hóa đơn đang chờ thanh toán (đang giữ hàng), không phụ thuộc kỳ báo cáo. */
    private function dangCho(): array
    {
        $r = DB::table('hoa_don')
            ->where('DaHuy', false)
            ->where('TrangThaiHoaDon', false)
            ->where('DaGiuHang', true)
            ->selectRaw('COUNT(*) as so_hoa_don, COALESCE(SUM("TongTien"), 0) as tong_tien')
            ->first();

        return ['so_hoa_don' => (int) $r->so_hoa_don, 'tong_tien' => (float) $r->tong_tien];
    }

    /** Trả về [top bán chạy, top sinh lời]. Doanh thu theo sản phẩm là TRƯỚC giảm giá. */
    private function sanPhamBan(Carbon $tu, Carbon $denTruoc, bool $laChu): array
    {
        $select = 'sp."MaSanPham", sp."TenSanPham", sp."LoaiSanPham",
                   SUM(ct."SoLuong") as so_luong, SUM(ct."ThanhTien") as doanh_thu'
            . ($laChu ? ', SUM(ct."SoLuong" * ct."GiaVon") as gia_von' : '');

        $rows = $this->chiTietHopLe($tu, $denTruoc)
            ->join('san_pham as sp', 'sp.MaSanPham', '=', 'ct.MaSanPham')
            ->selectRaw($select)
            ->groupBy('sp.MaSanPham', 'sp.TenSanPham', 'sp.LoaiSanPham')
            ->get()
            ->map(function ($r) use ($laChu) {
                $m = [
                    'MaSanPham'   => (int) $r->MaSanPham,
                    'TenSanPham'  => $r->TenSanPham,
                    'LoaiSanPham' => $r->LoaiSanPham,
                    'so_luong'    => (int) $r->so_luong,
                    'doanh_thu'   => (float) $r->doanh_thu,
                ];
                if ($laChu) {
                    $m['loi_nhuan'] = $m['doanh_thu'] - (float) $r->gia_von;
                }

                return $m;
            });

        $banChay = $rows->sortByDesc('so_luong')->take(10)->values()->all();
        $sinhLoi = $laChu ? $rows->sortByDesc('loi_nhuan')->take(10)->values()->all() : [];

        return [$banChay, $sinhLoi];
    }

    /** Sản phẩm còn hàng nhưng bán chậm nhất (kể cả chưa bán được cái nào trong kỳ). */
    private function banCham(Carbon $tu, Carbon $denTruoc, bool $laChu): array
    {
        $ban = $this->chiTietHopLe($tu, $denTruoc)
            ->groupBy('ct.MaSanPham')
            ->selectRaw('ct."MaSanPham", SUM(ct."SoLuong") as so_luong, SUM(ct."ThanhTien") as doanh_thu');

        $select = 'sp."MaSanPham", sp."TenSanPham", sp."LoaiSanPham", sp."SoLuongHienTai",
                   COALESCE(b."so_luong", 0) as so_luong, COALESCE(b."doanh_thu", 0) as doanh_thu'
            . ($laChu ? ', sp."SoLuongHienTai" * COALESCE(sp."DonGiaNhap", 0) as von_ton' : '');

        return DB::table('san_pham as sp')
            ->leftJoinSub($ban, 'b', 'b.MaSanPham', '=', 'sp.MaSanPham')
            ->where(fn ($q) => $q->where('sp.TrangThai', true)->orWhereNull('sp.TrangThai'))
            ->where('sp.SoLuongHienTai', '>', 0)
            // sản phẩm tạo sau kỳ báo cáo thì chưa thể coi là bán chậm
            ->where(fn ($q) => $q->whereNull('sp.created_at')->orWhere('sp.created_at', '<', $denTruoc))
            ->selectRaw($select)
            ->orderByRaw('COALESCE(b."so_luong", 0) ASC')
            ->orderByDesc('sp.SoLuongHienTai')
            ->limit(10)
            ->get()
            ->map(function ($r) use ($laChu) {
                $m = [
                    'MaSanPham'      => (int) $r->MaSanPham,
                    'TenSanPham'     => $r->TenSanPham,
                    'LoaiSanPham'    => $r->LoaiSanPham,
                    'SoLuongHienTai' => (int) $r->SoLuongHienTai,
                    'so_luong'       => (int) $r->so_luong,
                    'doanh_thu'      => (float) $r->doanh_thu,
                ];
                if ($laChu) {
                    $m['von_ton'] = (float) $r->von_ton;
                }

                return $m;
            })
            ->all();
    }
}
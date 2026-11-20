<?php

namespace App\Domains\CaLamViec\Http\Controllers;

use App\Domains\CaLamViec\Services\TuanLamViec;
use App\Http\Controllers\Controller;
use App\Models\CaLamViec;
use App\Models\LichDangKy;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LichDangKyController extends Controller
{
    public const DA_DANG_KY = 1;

    /** Mỗi ca tối đa 2 nhân viên đăng ký. */
    public const TOI_DA_NHAN_VIEN = 2;

    /** Quản lý/chủ được đăng ký chung ca với nhân viên, nhưng mỗi ca chỉ một người. */
    public const TOI_DA_QUAN_LY = 1;

    private const VAI_TRO_NHAN_VIEN = 3;

    public function danhSachCa(): JsonResponse
    {
        return response()->json(['data' => $this->cacCa()]);
    }

    /** Dữ liệu cho trang đăng ký: tuần sau, các ca, ca đã chọn và tình trạng chỗ trống từng ca. */
    public function tuanSau(Request $request): JsonResponse
    {
        $tuan = TuanLamViec::tuanDangKy();
        $user = $request->user();
        $laQuanLy = in_array((int) $user->MaVaiTro, [1, 2], true);

        $dangKy = DB::table('lich_dang_ky as ld')
            ->join('tai__khoan as tk', 'tk.MaTaiKhoan', '=', 'ld.MaTaiKhoan')
            ->where('ld.TrangThai', self::DA_DANG_KY)
            ->where('tk.TrangThai', true)
            ->whereBetween('ld.NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
            ->get(['ld.NgayDangKy', 'ld.MaCa', 'ld.MaTaiKhoan', 'tk.MaVaiTro']);

        $daChon = $dangKy
            ->filter(fn ($r) => (int) $r->MaTaiKhoan === (int) $user->MaTaiKhoan)
            ->map(fn ($r) => [
                'Ngay' => Carbon::parse($r->NgayDangKy)->toDateString(),
                'MaCa' => (int) $r->MaCa,
            ])
            ->values();

        // Số người đã đăng ký từng ca. "con_cho" tính theo vai trò của người đang xem và
        // không tính chính họ, để họ vẫn giữ lại / chọn lại được ca mình đang đăng ký.
        $daKy = $dangKy
            ->groupBy(fn ($r) => Carbon::parse($r->NgayDangKy)->toDateString() . '|' . (int) $r->MaCa)
            ->map(function ($nhom, $khoa) use ($user, $laQuanLy) {
                [$ngay, $maCa] = explode('|', $khoa);

                $nguoiKhac = $nhom->filter(fn ($r) => (int) $r->MaTaiKhoan !== (int) $user->MaTaiKhoan);
                $soNhanVien = $nhom->filter(fn ($r) => (int) $r->MaVaiTro === self::VAI_TRO_NHAN_VIEN)->count();
                $soQuanLy = $nhom->count() - $soNhanVien;
                $nvKhac = $nguoiKhac->filter(fn ($r) => (int) $r->MaVaiTro === self::VAI_TRO_NHAN_VIEN)->count();
                $qlKhac = $nguoiKhac->count() - $nvKhac;

                return [
                    'Ngay'         => $ngay,
                    'MaCa'         => (int) $maCa,
                    'so_nhan_vien' => $soNhanVien,
                    'so_quan_ly'   => $soQuanLy,
                    'con_cho'      => $laQuanLy
                        ? $qlKhac < self::TOI_DA_QUAN_LY
                        : $nvKhac < self::TOI_DA_NHAN_VIEN,
                ];
            })
            ->values();

        return response()->json([
            'tuan'     => $tuan,
            'ca'       => $this->cacCa(),
            'da_chon'  => $daChon,
            'da_ky'    => $daKy,
            'gioi_han' => [
                'nhan_vien' => self::TOI_DA_NHAN_VIEN,
                'quan_ly'   => self::TOI_DA_QUAN_LY,
            ],
        ]);
    }

    /** Lưu toàn bộ lựa chọn của người dùng cho tuần sau (thay thế lựa chọn cũ). */
    public function luuTuanSau(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ChiTiet'        => 'present|array|max:60',
            'ChiTiet.*.Ngay' => 'required|date_format:Y-m-d',
            'ChiTiet.*.MaCa' => 'required|integer|exists:ca_lam_viec,MaCa',
        ]);

        $tuan = TuanLamViec::tuanDangKy();
        if (!$tuan['dang_mo']) {
            return response()->json([
                'message' => 'Đã hết hạn đăng ký ca cho tuần sau (hạn là 23:59 thứ 7).',
            ], 422);
        }

        $chon = collect($data['ChiTiet'])
            ->map(fn ($c) => ['Ngay' => $c['Ngay'], 'MaCa' => (int) $c['MaCa']])
            ->unique(fn ($c) => $c['Ngay'] . '|' . $c['MaCa'])
            ->values();

        foreach ($chon as $c) {
            if ($c['Ngay'] < $tuan['tu_ngay'] || $c['Ngay'] > $tuan['den_ngay']) {
                return response()->json(['message' => "Ngày {$c['Ngay']} không thuộc tuần sau."], 422);
            }
        }

        $user = $request->user();
        $laQuanLy = in_array((int) $user->MaVaiTro, [1, 2], true);
        $tenCa = CaLamViec::pluck('TenCa', 'MaCa');

        try {
            DB::transaction(function () use ($chon, $tuan, $user, $laQuanLy, $tenCa) {
                LichDangKy::where('MaTaiKhoan', $user->MaTaiKhoan)
                    ->whereBetween('NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
                    ->delete();

                if ($chon->isNotEmpty()) {
                    // Khóa các dòng trong tuần để hai người không cùng lúc vượt giới hạn.
                    LichDangKy::where('TrangThai', self::DA_DANG_KY)
                        ->whereBetween('NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
                        ->lockForUpdate()
                        ->get();

                    $dangKy = DB::table('lich_dang_ky as ld')
                        ->join('tai__khoan as tk', 'tk.MaTaiKhoan', '=', 'ld.MaTaiKhoan')
                        ->where('ld.TrangThai', self::DA_DANG_KY)
                        ->where('tk.TrangThai', true)
                        ->whereBetween('ld.NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
                        ->get(['ld.NgayDangKy', 'ld.MaCa', 'tk.MaVaiTro']);

                    foreach ($chon as $c) {
                        $trongCa = $dangKy->filter(fn ($r) => Carbon::parse($r->NgayDangKy)->toDateString() === $c['Ngay']
                            && (int) $r->MaCa === $c['MaCa']);
                        $soNhanVien = $trongCa->filter(fn ($r) => (int) $r->MaVaiTro === self::VAI_TRO_NHAN_VIEN)->count();
                        $soQuanLy = $trongCa->count() - $soNhanVien;

                        $ten = $tenCa[$c['MaCa']] ?? ('Ca ' . $c['MaCa']);
                        $ngay = Carbon::parse($c['Ngay'])->format('d/m/Y');

                        if ($laQuanLy && $soQuanLy >= self::TOI_DA_QUAN_LY) {
                            throw ValidationException::withMessages([
                                'ChiTiet' => "Ca {$ten} ngày {$ngay} đã có quản lý đăng ký. Mỗi ca chỉ một quản lý hoặc chủ.",
                            ]);
                        }

                        if (!$laQuanLy && $soNhanVien >= self::TOI_DA_NHAN_VIEN) {
                            throw ValidationException::withMessages([
                                'ChiTiet' => "Ca {$ten} ngày {$ngay} đã đủ " . self::TOI_DA_NHAN_VIEN . ' nhân viên.',
                            ]);
                        }
                    }
                }

                foreach ($chon as $c) {
                    LichDangKy::create([
                        'NgayDangKy' => $c['Ngay'],
                        'TrangThai'  => self::DA_DANG_KY,
                        'MaTaiKhoan' => $user->MaTaiKhoan,
                        'MaCa'       => $c['MaCa'],
                    ]);
                }
            });
        } catch (UniqueConstraintViolationException $e) {
            return response()->json(['message' => 'Bạn vừa gửi đăng ký hai lần, vui lòng thử lại.'], 409);
        }

        return response()->json([
            'message' => $chon->isEmpty()
                ? 'Đã hủy toàn bộ đăng ký tuần sau.'
                : "Đã lưu {$chon->count()} ca đăng ký cho tuần sau.",
        ]);
    }

    /** Thời khóa biểu cả tuần cho chủ và quản lý. ?tu_ngay=YYYY-MM-DD (ngày bất kỳ trong tuần). */
    public function thoiKhoaBieu(Request $request): JsonResponse
    {
        $request->validate(['tu_ngay' => 'nullable|date_format:Y-m-d']);

        $tuan = TuanLamViec::tuanChua($request->query('tu_ngay'));

        $dangKy = DB::table('lich_dang_ky as ld')
            ->join('tai__khoan as tk', 'tk.MaTaiKhoan', '=', 'ld.MaTaiKhoan')
            ->where('ld.TrangThai', self::DA_DANG_KY)
            ->where('tk.TrangThai', true) // tài khoản bị khóa không hiện trong lịch
            ->where('tk.MaVaiTro', self::VAI_TRO_NHAN_VIEN) // không hiện tên quản lý và chủ
            ->whereBetween('ld.NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
            ->orderBy('ld.NgayDangKy')
            ->orderBy('ld.MaCa')
            ->orderBy('tk.HoTen')
            ->get(['ld.NgayDangKy as Ngay', 'ld.MaCa', 'tk.MaTaiKhoan', 'tk.HoTen']);

        return response()->json([
            'tuan' => $tuan + [
                'la_tuan_dang_ky' => $tuan['tu_ngay'] === TuanLamViec::tuanDangKy()['tu_ngay'],
            ],
            'ca'   => $this->cacCa(),
            'data' => $dangKy->values(),
        ]);
    }

    private function cacCa()
    {
        return CaLamViec::orderBy('GioBatDau')
            ->get(['MaCa', 'TenCa', 'GioBatDau', 'GioKetThuc'])
            ->values();
    }
}
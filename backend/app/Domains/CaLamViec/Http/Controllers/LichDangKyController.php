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

class LichDangKyController extends Controller
{
    public const DA_DANG_KY = 1;

    public function danhSachCa(): JsonResponse
    {
        return response()->json(['data' => $this->cacCa()]);
    }

    /** Dữ liệu cho trang đăng ký: tuần sau, các ca, và những ca người dùng đã chọn. */
    public function tuanSau(Request $request): JsonResponse
    {
        $tuan = TuanLamViec::tuanDangKy();

        $daChon = LichDangKy::where('MaTaiKhoan', $request->user()->MaTaiKhoan)
            ->where('TrangThai', self::DA_DANG_KY)
            ->whereBetween('NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
            ->get(['NgayDangKy', 'MaCa'])
            ->map(fn ($r) => [
                'Ngay' => Carbon::parse($r->NgayDangKy)->toDateString(),
                'MaCa' => (int) $r->MaCa,
            ])
            ->values();

        return response()->json([
            'tuan'    => $tuan,
            'ca'      => $this->cacCa(),
            'da_chon' => $daChon,
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

        try {
            DB::transaction(function () use ($chon, $tuan, $user) {
                LichDangKy::where('MaTaiKhoan', $user->MaTaiKhoan)
                    ->whereBetween('NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
                    ->delete();

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
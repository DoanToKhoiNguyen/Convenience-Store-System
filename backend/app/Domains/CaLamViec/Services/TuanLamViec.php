<?php

namespace App\Domains\CaLamViec\Services;

use Illuminate\Support\Carbon;

class TuanLamViec
{
    /** Tuần sau (thứ 2 → chủ nhật): tuần nhân viên đang đăng ký, hạn 23:59 thứ 7 của tuần này. */
    public static function tuanDangKy(): array
    {
        $dauTuanSau = Carbon::today()->startOfWeek(Carbon::MONDAY)->addWeek();
        $han = $dauTuanSau->copy()->subDays(2)->endOfDay();

        return [
            'tu_ngay'  => $dauTuanSau->toDateString(),
            'den_ngay' => $dauTuanSau->copy()->endOfWeek(Carbon::SUNDAY)->toDateString(),
            'han'      => $han->toDateTimeString(),
            'dang_mo'  => now()->lessThanOrEqualTo($han),
        ];
    }

    /** Tuần (thứ 2 → chủ nhật) chứa một ngày bất kỳ; không truyền thì lấy tuần hiện tại. */
    public static function tuanChua(?string $ngay): array
    {
        $dau = ($ngay ? Carbon::parse($ngay) : Carbon::today())->startOfWeek(Carbon::MONDAY);

        return [
            'tu_ngay'  => $dau->toDateString(),
            'den_ngay' => $dau->copy()->endOfWeek(Carbon::SUNDAY)->toDateString(),
        ];
    }
}
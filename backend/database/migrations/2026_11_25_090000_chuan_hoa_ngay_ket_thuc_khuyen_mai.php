<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Trước 24/11, form khuyến mãi lưu 00:00:00 và 23:59:59 theo UTC. Khi chuyển dữ liệu
     * sang giờ Việt Nam (+7 giờ), hai mốc này thành 07:00:00 và 06:59:59 của ngày hôm sau,
     * nên "Ngày kết thúc" bị hiển thị lệch một ngày. Chỉ các dòng mang đúng dấu vết này
     * mới được đưa về đầu ngày và cuối ngày theo lịch; các chương trình đặt giờ cụ thể
     * (ví dụ 12:01:48) giữ nguyên.
     */
    public function up(): void
    {
        $dieuKien = match (DB::getDriverName()) {
            'pgsql' => "to_char(\"NgayBatDau\", 'HH24:MI:SS') = '07:00:00'
                        AND to_char(\"NgayKetThuc\", 'HH24:MI:SS') = '06:59:59'",
            'sqlite' => "time(\"NgayBatDau\") = '07:00:00' AND time(\"NgayKetThuc\") = '06:59:59'",
            default => null,
        };

        if ($dieuKien === null) {
            return;
        }

        [$batDau, $ketThuc] = match (DB::getDriverName()) {
            'pgsql' => [
                "date_trunc('day', \"NgayBatDau\")",
                "date_trunc('day', \"NgayKetThuc\" - interval '1 day') + interval '23 hours 59 minutes 59 seconds'",
            ],
            'sqlite' => [
                "datetime(\"NgayBatDau\", 'start of day')",
                "datetime(\"NgayKetThuc\", '-1 day', 'start of day', '+23 hours', '+59 minutes', '+59 seconds')",
            ],
        };

        DB::table('khuyen_mai')
            ->whereRaw($dieuKien)
            ->update([
                'NgayBatDau'  => DB::raw($batDau),
                'NgayKetThuc' => DB::raw($ketThuc),
            ]);
    }

    /**
     * Không hoàn tác: chương trình tạo sau khi sửa múi giờ đã đúng sẵn, cộng lại 7 giờ
     * sẽ làm hỏng các dòng đó.
     */
    public function down(): void
    {
    }
};

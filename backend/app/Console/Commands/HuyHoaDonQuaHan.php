<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use App\Domains\BanHang\Services\HoaDonService;
use Illuminate\Console\Command;

#[Signature('hoa-don:huy-qua-han')]
#[Description('Command description')]
class HuyHoaDonQuaHan extends Command
{
    protected $signature = 'hoa-don:huy-qua-han';
    protected $description = 'Hủy hóa đơn chờ thanh toán quá 1 giờ và hoàn lại tồn kho';


    public function handle(HoaDonService $service): int
    {
        $huy = $service->huyQuaHan();
        $nhap = $service->donNhapCu();

        if ($huy || $nhap) {
            $this->info("Đã hủy {$huy} hóa đơn quá hạn, dọn {$nhap} hóa đơn nháp bỏ dở.");
        }

        return self::SUCCESS;
    }
}

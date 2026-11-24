<?php

namespace App\Console\Commands;

use App\Domains\LoHang\Services\LoHangService;
use Illuminate\Console\Command;

class LoaiLoHetHan extends Command
{
    protected $signature = 'lo-hang:loai-het-han';
    protected $description = 'Tự động loại các lô đã hết hạn khỏi tồn kho và ghi nhật ký';

    public function handle(LoHangService $service): int
    {
        $soLo = $service->loaiLoHetHan();

        if ($soLo) {
            $this->info("Đã tự động loại {$soLo} lô hàng hết hạn.");
        }

        return self::SUCCESS;
    }
}

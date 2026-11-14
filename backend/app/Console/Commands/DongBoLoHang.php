<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Domains\LoHang\Services\LoHangService;

#[Signature('lo-hang:dong-bo')]
#[Description('Command description')]
class DongBoLoHang extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(LoHangService $service): int
    {
        $kq = $service->dongBoTatCa();
        $this->info("Đã tạo {$kq['tao']} lô tồn đầu kỳ.");
        foreach ($kq['lech'] as $l) {
            $this->warn($l);
        }

        return self::SUCCESS;
    }
}

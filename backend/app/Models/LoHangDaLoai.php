<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoHangDaLoai extends Model
{
    protected $table = 'lo_hang_da_loai';
    protected $primaryKey = 'MaLoai';
    protected $fillable = [
        'MaLoHang', 'MaSanPham', 'TenSanPham', 'MaLo',
        'HanSuDung', 'SoLuongLoai', 'ThoiGianLoai', 'MaTaiKhoan', 'LyDo',
    ];
    protected $casts = [
        'HanSuDung'    => 'date:Y-m-d',
        'ThoiGianLoai' => 'datetime',
    ];

    public function taiKhoan()
    {
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan');
    }
}

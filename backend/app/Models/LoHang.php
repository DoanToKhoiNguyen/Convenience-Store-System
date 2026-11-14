<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoHang extends Model
{
    protected $table = 'lo_hang';
    protected $primaryKey = 'MaLoHang';
    protected $fillable = [
        'MaLo', 'MaSanPham', 'MaPhieuNhap', 'MaChiTietPhieuNhap',
        'NgayNhap', 'HanSuDung', 'SoLuongNhap', 'SoLuongCon', 'GhiChu',
    ];
    protected $casts = [
        'NgayNhap'  => 'datetime',
        'HanSuDung' => 'date:Y-m-d', // giữ nguyên Y-m-d khi trả JSON, tránh lệch ngày do múi giờ
    ];

    public function sanPham()
    {
        return $this->belongsTo(SanPham::class, 'MaSanPham', 'MaSanPham');
    }
}
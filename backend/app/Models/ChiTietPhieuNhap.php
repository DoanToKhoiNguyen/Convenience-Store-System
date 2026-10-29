<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChiTietPhieuNhap extends Model
{
    protected $table = 'chi_tiet_phieu_nhap';
    protected $primaryKey = 'MaChiTietPhieuNhap';
    protected $fillable = ['TenSanPham', 'SoLuong', 'DonGia', 'TongGia', 'MaPhieuNhap', 'MaSanPham',
    'NgaySanXuat'];

    public function phieuNhap(){
        return $this->belongsTo(PhieuNhap::class, 'MaPhieuNhap', 'MaPhieuNhap');
    }
    public function sanPham(){
        return $this->belongsTo(SanPham::class, 'MaSanPham', 'MaSanPham');
    }
}

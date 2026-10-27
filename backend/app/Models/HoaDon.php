<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HoaDon extends Model
{
    protected $table = 'hoa_don';
    protected $primaryKey = 'MaHoaDon';
    protected $fillable = ['NgayLap', 'TongTien', 'MaGiaoDich', 'TenGiaoDich', 
    'TrangThaiHoaDon', 'TienGiamGia', 'MaTaiKhoan', 'MaKhuyenMai'];

    public function taiKhoan() { 
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function khuyenMai() { 
        return $this->belongsTo(KhuyenMai::class, 'MaKhuyenMai', 'MaKhuyenMai'); 
    }
    public function chiTietHoaDon() { 
        return $this->hasMany(ChiTietHoaDon::class, 'MaHoaDon', 'MaHoaDon'); 
    }
    public function sanPham()
    {
        return $this->belongsTo(SanPham::class, 'MaSanPham', 'MaSanPham');
    }
}

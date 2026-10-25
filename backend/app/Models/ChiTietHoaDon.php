<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChiTietHoaDon extends Model
{
    protected $table = 'chi_tiet_hoa_don';
    protected $primaryKey = 'MaChiTietHoaDon';
    protected $fillable = ['TenSanPham', 'SoLuong', 'ThanhTien', 'MaHoaDon', 'MaSanPham'];

    public function hoaDon() { 
        return $this->belongsTo(HoaDon::class, 'MaHoaDon', 'MaHoaDon'); 
    }
    public function sanPham() { 
        return $this->belongsTo(SanPham::class, 'MaSanPham', 'MaSanPham'); 
    }
}

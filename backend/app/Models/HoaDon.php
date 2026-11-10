<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HoaDon extends Model
{
    protected $table = 'hoa_don';
    protected $primaryKey = 'MaHoaDon';
    protected $fillable = ['NgayLap', 'TongTien', 'MaGiaoDich', 'TenGiaoDich', 
    'TrangThaiHoaDon', 'TienGiamGia', 'MaTaiKhoan', 'MaKhuyenMai',
    'DaGiuHang', 'HanThanhToan', 'DaHuy', 'LyDoHuy', 'NgayThanhToan', 'TongTienHang'];

    protected $casts = [
        'NgayLap'         => 'datetime',
        'HanThanhToan'    => 'datetime',
        'NgayThanhToan'   => 'datetime',
        'TrangThaiHoaDon' => 'boolean',
        'DaGiuHang'       => 'boolean',
        'DaHuy'           => 'boolean',
    ];
    protected $appends = ['trang_thai_text'];

    public function getTrangThaiTextAttribute(): string
    {
        if ($this->DaHuy) return 'da_huy';
        if ($this->TrangThaiHoaDon) return 'da_thanh_toan';
        return $this->DaGiuHang ? 'cho_thanh_toan' : 'nhap';
    }
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

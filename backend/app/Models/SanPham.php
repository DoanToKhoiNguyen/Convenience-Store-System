<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SanPham extends Model
{
    protected $table = 'san_pham';
    protected $primaryKey = 'MaSanPham';
    protected $fillable = ['TenSanPham', 'DonGiaBan', 'DonGiaNhap', 'TonKhoToiThieu', 'TonKhoToiDa', 
    'CanhBaoHSD', 'SoLuongHienTai', 'TenThuongHieu', 'MoTa', 
    'ThanhPhan', 'TrangThai', 'LoaiSanPham', 'MaNhaCungCap', 'HinhAnh', 'TienToLo'];

    protected $appends = ['hinh_anh_url'];
    protected $casts = ['TrangThai' => 'boolean'];
    
    public function getHinhAnhUrlAttribute(): ?string
    {
        return $this->HinhAnh ? '/storage/' . ltrim($this->HinhAnh, '/') : null;
    }

    public function capNhatTonKho() { 
        return $this->hasMany(CapNhatTonKho::class, 'MaSanPham', 'MaSanPham'); 
    }
    public function chiTietPhieuNhap() { 
        return $this->hasMany(ChiTietPhieuNhap::class, 'MaSanPham', 'MaSanPham'); 
    }
    public function chiTietHoaDon() { 
        return $this->hasMany(ChiTietHoaDon::class, 'MaSanPham', 'MaSanPham'); 
    }
    public function nhaCungCap(){
        return $this->belongsTo(NhaCungCap::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
    public function danhMuc()
    {
        return $this->belongsTo(DanhMuc::class, 'MaDanhMuc', 'MaDanhMuc');
    }
    public function loHang()
    {
        return $this->hasMany(LoHang::class, 'MaSanPham', 'MaSanPham');
    }
}

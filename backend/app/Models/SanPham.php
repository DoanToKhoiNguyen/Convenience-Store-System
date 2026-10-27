<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SanPham extends Model
{
    protected $table = 'san_pham';
    protected $primaryKey = 'MaSanPham';
    protected $fillable = ['TenSanPham', 'DonGiaBan', 'TonKhoToiThieu', 'TonKhoToiDa', 
    'CanhBaoHSD', 'SoLuongHienTai', 'TenThuongHieu', 'MoTa', 'ThanhPhan', 'LoaiSanPham'];

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

}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CapNhatTonKho extends Model
{
    protected $table = 'cap_nhat_ton_kho';
    protected $primaryKey = 'MaCapNhat';
    protected $fillable = ['ThoiGianCapNhat', 'SoLuongMoi', 'SoLuongHienTai', 
    'LyDoCapNhat', 'MaTaiKhoan', 'MaSanPham'];

    public function taiKhoan() { 
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function sanPham() { 
        return $this->belongsTo(SanPham::class, 'MaSanPham', 'MaSanPham'); 
    }
}

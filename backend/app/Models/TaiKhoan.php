<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaiKhoan extends Model
{
    protected $table = 'tai__khoan';
    protected $primaryKey = 'MaTaiKhoan';
    protected $fillable = ['TenDangNhap', 'MatKhau', 'HoTen', 'Email', 'SoDienThoai', 'TrangThai', 'MaVaiTro'];
    protected $hidden = ['MatKhau'];

    public function getAuthPassword() { 
        return $this->MatKhau; 
    }

    public function vaiTro() {
        return $this->belongsToMany(VaiTro::class, 'tai_khoan_vai_tro', 'MaTaiKhoan', 'MaVaiTro');
    }
    public function hoaDon() { 
        return $this->hasMany(HoaDon::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function phieuNhap() { 
        return $this->hasMany(PhieuNhap::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function phanCong() { 
        return $this->hasMany(PhanCong::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function lichDangKy() { 
        return $this->hasMany(LichDangKy::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhieuNhap extends Model
{
    protected $table = 'phieu_nhap';
    protected $primaryKey = 'MaPhieuNhap';
    protected $fillable = ['NgayLap', 'TrangThai', 'TongGiaTri', 'MaTaiKhoan', 'MaNhaCungCap'];

    public function taikhoan(){
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan');
    }
    public function nhaCungCap(){
        return $this->belongsTo(NhaCungCap::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
    public function chiTietPhieuNhap(){
        return $this->hasMany(chiTietPhieuNhap::class, 'MaPhieuNhap', 'MaPhieuNhap');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NhaCungCap extends Model
{
    protected $table = 'nha_cung_cap';
    protected $primaryKey = 'MaNhaCungCap';
    protected $fillable = ['TenNhaCungCap', 'DiaChi', 'SoDienThoai', 'TrangThai'];
    protected $casts = ['TrangThai' => 'boolean'];

    public function phieunhap(){
        return $this->hasMany(PhieuNhap::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
    public function sanPham(){
        return $this->hasMany(SanPham::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
    public function danhMuc()
    {
        return $this->belongsToMany(DanhMuc::class, 'nha_cung_cap_danh_muc', 'MaNhaCungCap', 'MaDanhMuc', 'MaNhaCungCap', 'MaDanhMuc');
    }
}

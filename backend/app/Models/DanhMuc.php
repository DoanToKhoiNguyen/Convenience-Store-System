<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DanhMuc extends Model
{
    protected $table = 'danh_muc';
    protected $primaryKey = 'MaDanhMuc';
    protected $fillable = ['TenDanhMuc', 'MoTa'];

    public function sanPham()
    {
        return $this->hasMany(SanPham::class, 'MaDanhMuc', 'MaDanhMuc');
    }
    public function nhaCungCap()
    {
        return $this->belongsToMany(NhaCungCap::class, 'nha_cung_cap_danh_muc', 'MaDanhMuc', 'MaNhaCungCap', 'MaDanhMuc', 'MaNhaCungCap');
    }
}
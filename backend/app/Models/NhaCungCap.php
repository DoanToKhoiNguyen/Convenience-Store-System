<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NhaCungCap extends Model
{
    protected $table = 'nha_cung_cap';
    protected $primaryKey = 'MaNhaCungCap';
    protected $fillable = ['TenNhaCungCap', 'DiaChi', 'SoDienThoai'];

    public function phieunhap(){
        return $this->hasMany(PhieuNhap::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
}

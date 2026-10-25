<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KhuyenMai extends Model
{
    protected $table = 'khuyen_mai';
    protected $primaryKey = 'MaKhuyenMai';
    protected $fillable = ['TenChuongTrinh', 'GiaTriGiam', 'DieuKienApDung', 'NgayBatDau', 'NgayKetThuc'];

    public function hoaDon() { 
        return $this->hasMany(HoaDon::class, 'MaKhuyenMai', 'MaKhuyenMai'); 
    }
}

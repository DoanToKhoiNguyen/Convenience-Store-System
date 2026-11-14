<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HoaDonLo extends Model
{
    protected $table = 'hoa_don_lo';
    protected $primaryKey = 'MaHoaDonLo';
    protected $fillable = ['MaChiTietHoaDon', 'MaLoHang', 'SoLuong'];
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LichDangKy extends Model
{
    protected $table = 'lich_dang_ky';
    protected $primaryKey = 'MaDangKy';
    protected $fillable = ['NgayDangKy', 'TrangThai', 'MaTaiKhoan', 'MaCa'];

    public function taiKhoan() { 
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function caLamViec() { 
        return $this->belongsTo(CaLamViec::class, 'MaCa', 'MaCa'); 
    }
}

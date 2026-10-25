<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhanCong extends Model
{
    protected $table = 'phan_cong';
    protected $primaryKey = 'MaPhanCong';
    protected $fillable = ['NgayLamViec', 'TrangThai', 'MaTaiKhoan', 'MaCa'];

    public function taiKhoan() { 
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan'); 
    }
    public function caLamViec() { 
        return $this->belongsTo(CaLamViec::class, 'MaCa', 'MaCa'); 
    }
}

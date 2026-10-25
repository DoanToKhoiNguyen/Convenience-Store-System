<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CaLamViec extends Model
{
    protected $table = 'ca_lam_viec';
    protected $primaryKey = 'MaCa';
    protected $fillable = ['TenCa', 'GioBatDau', 'GioKetThuc'];

    public function phanCong() { 
        return $this->hasMany(PhanCong::class, 'MaCa', 'MaCa'); 
    }
    public function lichDangKy() { 
        return $this->hasMany(LichDangKy::class, 'MaCa', 'MaCa'); 
    }
}

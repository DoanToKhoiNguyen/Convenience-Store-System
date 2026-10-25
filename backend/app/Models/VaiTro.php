<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VaiTro extends Model
{
    protected $table = 'vai_tro';
    protected $primaryKey = 'MaVaiTro';
    protected $fillable = ['MaVaiTro', 'TenVaiTro'];

    public function taikhoan(){
        return $this->belongsToMany(
            TaiKhoan::class, 'tai_khoan_vai_tro', 'MaVaiTro', 'MaTaiKhoan', 'MaVaiTro', 'MaTaiKhoan'
        );
    }
    
}

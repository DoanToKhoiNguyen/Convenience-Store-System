<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KhuyenMai extends Model
{
    protected $table = 'khuyen_mai';
    protected $primaryKey = 'MaKhuyenMai';
    protected $fillable = [
        'TenChuongTrinh', 'LoaiGiam', 'GiaTriGiam', 'DieuKienApDung',
        'GiamToiDa', 'NgayBatDau', 'NgayKetThuc', 'TrangThai',
    ];
    protected $casts = [
        'NgayBatDau'  => 'datetime',
        'NgayKetThuc' => 'datetime',
        'TrangThai'   => 'boolean',
    ];
    protected $appends = ['trang_thai_text'];

    public function hoaDon()
    {
        return $this->hasMany(HoaDon::class, 'MaKhuyenMai', 'MaKhuyenMai');
    }

    public function scopeDangChay($query)
    {
        return $query->where('TrangThai', true)
            ->where('NgayBatDau', '<=', now())
            ->where('NgayKetThuc', '>=', now());
    }

    public function getTrangThaiTextAttribute(): string
    {
        if (!$this->TrangThai) return 'tam_ngung';
        if ($this->NgayBatDau && $this->NgayBatDau->isFuture()) return 'sap_chay';
        if ($this->NgayKetThuc && $this->NgayKetThuc->isPast()) return 'het_han';
        return 'dang_chay';
    }
}
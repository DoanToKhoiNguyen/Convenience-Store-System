<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhieuNhap extends Model
{
    protected $table = 'phieu_nhap';
    protected $primaryKey = 'MaPhieuNhap';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'MaPhieuNhap', 'NgayLap', 'TrangThai', 'TongGiaTri', 'MaTaiKhoan', 'MaNhaCungCap',
        'MaTaiKhoanDuyet', 'NgayDuyet', 'MaTaiKhoanNhan', 'NgayNhan',
    ];

    // Giữ đúng định dạng giờ như NgayLap (app đang chạy múi giờ UTC) để hiển thị nhất quán
    protected $casts = [
        'NgayDuyet' => 'datetime:Y-m-d H:i:s',
        'NgayNhan'  => 'datetime:Y-m-d H:i:s',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $phieu) {
            $phieu->MaPhieuNhap ??= self::sinhMaMoi();
        });
    }

    /** Mã phiếu kế tiếp: PN01, PN02, ... (từ 100 trở lên thành PN100). */
    public static function sinhMaMoi(): string
    {
        $soLonNhat = static::query()->pluck('MaPhieuNhap')->reduce(
            fn (int $max, $ma) => max($max, (int) preg_replace('/\D/', '', (string) $ma)),
            0,
        );

        return 'PN' . str_pad((string) ($soLonNhat + 1), 2, '0', STR_PAD_LEFT);
    }

    public function taikhoan(){
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoan', 'MaTaiKhoan');
    }
    public function nguoiDuyet(){
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoanDuyet', 'MaTaiKhoan');
    }
    public function nguoiNhan(){
        return $this->belongsTo(TaiKhoan::class, 'MaTaiKhoanNhan', 'MaTaiKhoan');
    }
    public function nhaCungCap(){
        return $this->belongsTo(NhaCungCap::class, 'MaNhaCungCap', 'MaNhaCungCap');
    }
    public function chiTietPhieuNhap(){
        return $this->hasMany(chiTietPhieuNhap::class, 'MaPhieuNhap', 'MaPhieuNhap');
    }
}

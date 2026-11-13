<?php

namespace App\Domains\SanPham\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\SanPham;
use Illuminate\Http\JsonResponse;

class SanPhamCongKhaiController extends Controller
{
    /** Danh sách sản phẩm cho khách xem. Chỉ trả các trường an toàn, không có giá nhập hay số lượng tồn. */
    public function index(): JsonResponse
    {
        $data = SanPham::query()
            ->where(fn ($q) => $q->where('TrangThai', true)->orWhereNull('TrangThai'))
            ->whereNotNull('DonGiaBan')
            ->orderBy('TenSanPham')
            ->limit(2000)
            ->get()
            ->map(fn (SanPham $sp) => [
                'MaSanPham'     => $sp->MaSanPham,
                'TenSanPham'    => $sp->TenSanPham,
                'DonGiaBan'     => (float) $sp->DonGiaBan,
                'TenThuongHieu' => $sp->TenThuongHieu,
                'LoaiSanPham'   => $sp->LoaiSanPham,
                'MoTa'          => $sp->MoTa,
                'ThanhPhan'     => $sp->ThanhPhan,
                'hinh_anh_url'  => $sp->hinh_anh_url,
                'con_hang'      => (int) $sp->SoLuongHienTai > 0,
            ])
            ->values();

        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=30');
    }
}
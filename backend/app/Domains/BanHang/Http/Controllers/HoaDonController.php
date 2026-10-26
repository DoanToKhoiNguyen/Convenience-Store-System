<?php

namespace App\Domains\BanHang\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\HoaDon;
use App\Models\ChiTietHoaDon;
use App\Models\SanPham;
use Illuminate\Support\Facades\DB;

class HoaDonController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $hoaDon = HoaDon::create([
            'ngayLap'     => now(),
            'trangThaiHD' => false, // Chưa thanh toán
            'tongTien'    => 0,     // Ban đầu tổng tiền bằng 0
            'maTaiKhoan'  => $request->user()->MaTaiKhoan, // Lấy nhân viên đang đăng nhập
        ]);

        return response()->json([
            'message' => 'Tạo hóa đơn nháp thành công!',
            'data'    => $hoaDon
        ], 201);
    }
}
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
            'NgayLap'     => now(),
            'TrangThaiHoaDon' => false, // Chưa thanh toán
            'TongTien'    => 0,     // Ban đầu tổng tiền bằng 0
            'MaTaiKhoan'  => $request->user()->MaTaiKhoan, // Lấy nhân viên đang đăng nhập
        ]);

        return response()->json([
            'message' => 'Tạo hóa đơn nháp thành công!',
            'data'    => $hoaDon
        ], 201);
    }

    public function addChiTiet(Request $request, $maHD): JsonResponse
    {
        $validated = $request->validate([
            'TenSanPham' => 'required|string',
            'SoLuong'    => 'required|integer|min:1',
        ]);

        $hoaDon = HoaDon::where('MaHoaDon', $maHD)->first();
        if (!$hoaDon) {
            return response()->json(['message' => 'Không tìm thấy hóa đơn.'], 404);
        }

        // Tìm sản phẩm theo tên để lấy mã sản phẩm và đơn giá
        $sanPham = SanPham::where('TenSanPham', $validated['TenSanPham'])->first();
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm này.'], 404);
        }

        $thanhTien = $sanPham->DonGiaBan * $validated['SoLuong'];

        DB::beginTransaction();
        try {
            // Tạo dòng chi tiết hóa đơn (maCTHD tự tăng, maHD lấy từ URL)
            $chiTiet = ChiTietHoaDon::create([
                'MaHoaDon'      => $maHD,
                'MaSanPham'      => $sanPham->MaSanPham,
                'TenSanPham'    => $sanPham->TenSanPham,
                'SoLuong'   => $validated['SoLuong'],
                'ThanhTien' => $thanhTien,
            ]);

            // Cập nhật lại tổng tiền của hóa đơn
            $hoaDon->TongTien += $thanhTien;
            $hoaDon->save();

            DB::commit();

            return response()->json([
                'message' => 'Thêm sản phẩm vào hóa đơn thành công!',
                'data'    => [
                    'hoaDon'  => $hoaDon->load('chiTietHoaDon'),
                    'chiTiet' => $chiTiet
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi khi thêm sản phẩm.', 'error' => $e->getMessage()], 500);
        }
    }

    public function thanhToan(Request $request, $maHD): JsonResponse
    {
        $hoaDon = HoaDon::with('chiTietHoaDon.sanPham')->where('MaHoaDon', $maHD)->first();

        if (!$hoaDon) {
            return response()->json(['message' => 'Không tìm thấy hóa đơn.'], 404);
        }

        if ($hoaDon->TrangThaiHoaDon) {
            return response()->json(['message' => 'Hóa đơn này đã được thanh toán trước đó.'], 400);
        }

        DB::beginTransaction();
        try {
            foreach ($hoaDon->chiTietHoaDon as $chiTiet) {
                $sanPham = $chiTiet->sanPham;

                // Kiểm tra tồn kho trước khi trừ
                if ($sanPham->SoLuongHienTai < $chiTiet->SoLuong) {
                    return response()->json([
                        'message' => "Sản phẩm '{$sanPham->TenSanPham}' không đủ số lượng trong kho."
                    ], 400);
                }

                // Trừ số lượng tồn kho
                $sanPham->SoLuongHienTai -= $chiTiet->SoLuong;
                $sanPham->save();
            }

            // Cập nhật trạng thái thành công (true) và thông tin thanh toán nếu có
            $hoaDon->TrangThaiHoaDon = true;
            $hoaDon->MaGiaoDich  = $request->input('maGiaoDich');
            $hoaDon->TenGiaoDich = $request->input('tenGiaoDich');
            $hoaDon->TienGiamGia = $request->input('tienGiamGia', 0);
            $hoaDon->save();

            DB::commit();

            return response()->json([
                'message' => 'Thanh toán thành công và đã trừ tồn kho!',
                'data'    => $hoaDon
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi thanh toán.', 'error' => $e->getMessage()], 500);
        }
    }

    public function index(Request $request): JsonResponse
    {
        // Lấy danh sách hóa đơn, kèm theo chi tiết hóa đơn và sắp xếp mới nhất lên đầu
        $danhSachHoaDon = HoaDon::with(['chiTietHoaDon', 'taiKhoan'])
                            ->orderBy('MaHoaDon', 'desc')
                            ->get();

        return response()->json([
            'message' => 'Lấy danh sách hóa đơn thành công!',
            'data'    => $danhSachHoaDon
        ]);
    }

    public function huyNhap(Request $request, $maHD): JsonResponse
    {
        $hoaDon = HoaDon::where('MaHoaDon', $maHD)->first();
        if (!$hoaDon) {
            return response()->json(['message' => 'Không tìm thấy hóa đơn.'], 404);
        }
        if ($hoaDon->TrangThaiHoaDon) {
            return response()->json(['message' => 'Hóa đơn đã thanh toán, không thể hủy.'], 400);
        }

        // Nhân viên chỉ được hủy hóa đơn nháp do chính mình tạo
        $user = $request->user();
        if ((int) $user->MaVaiTro === 3 && $hoaDon->MaTaiKhoan != $user->MaTaiKhoan) {
            return response()->json(['message' => 'Bạn không có quyền hủy hóa đơn này.'], 403);
        }

        DB::transaction(function () use ($hoaDon) {
            ChiTietHoaDon::where('MaHoaDon', $hoaDon->MaHoaDon)->delete();
            $hoaDon->delete();
        });

        return response()->json(['message' => 'Đã hủy hóa đơn nháp.']);
    }
}
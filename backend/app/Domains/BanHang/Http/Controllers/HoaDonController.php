<?php

namespace App\Domains\BanHang\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\HoaDon;
use App\Models\ChiTietHoaDon;
use App\Models\SanPham;
use Illuminate\Support\Facades\DB;
use App\Domains\BanHang\Services\HoaDonService;
use App\Domains\KhuyenMai\Services\KhuyenMaiService;

class HoaDonController extends Controller
{
    
    public function store(Request $request): JsonResponse
    {
        $hoaDon = HoaDon::create([
            'NgayLap'     => now(),
            'TrangThaiHoaDon' => false, // Chưa thanh toán
            'TongTien'    => 0,     // Ban đầu tổng tiền bằng 0
            'MaTaiKhoan'  => $request->user()->MaTaiKhoan, // Lấy nhân viên đang đăng nhập
            'TongTienHang' => 0
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

        $sanPham = SanPham::where('TenSanPham', $validated['TenSanPham'])
            ->where('TrangThai', true)
            ->first();
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm này.'], 404);
        }

        try {
            $ketQua = DB::transaction(function () use ($maHD, $validated, $sanPham) {
                $hoaDon = HoaDon::where('MaHoaDon', $maHD)->lockForUpdate()->first();
                if (!$hoaDon) {
                    throw new \DomainException('Không tìm thấy hóa đơn.', 404);
                }
                if ($hoaDon->DaHuy || $hoaDon->TrangThaiHoaDon || $hoaDon->DaGiuHang) {
                    throw new \DomainException('Hóa đơn này không còn chỉnh sửa được.', 400);
                }

                $thanhTien = (float) $sanPham->DonGiaBan * $validated['SoLuong'];

                $chiTiet = ChiTietHoaDon::create([
                    'MaHoaDon'   => $hoaDon->MaHoaDon,
                    'MaSanPham'  => $sanPham->MaSanPham,
                    'TenSanPham' => $sanPham->TenSanPham,
                    'SoLuong'    => $validated['SoLuong'],
                    'ThanhTien'  => $thanhTien,
                    'GiaVon' => (float) ($sanPham->DonGiaNhap ?? 0),
                ]);

                $hoaDon->TongTienHang = (float) $hoaDon->TongTienHang + $thanhTien;
                $this->khuyenMai->apDungChoHoaDon($hoaDon); // tính TienGiamGia, MaKhuyenMai, TongTien
                $hoaDon->save();

                return [
                    'hoaDon'  => $hoaDon->load('chiTietHoaDon', 'khuyenMai'),
                    'chiTiet' => $chiTiet,
                ];
            });
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 400);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Lỗi khi thêm sản phẩm.'], 500);
        }

        return response()->json(['message' => 'Thêm sản phẩm vào hóa đơn thành công!', 'data' => $ketQua]);
    }

    public function thanhToan(Request $request, $maHD): JsonResponse
    {
        try {
            $hoaDon = $this->service->thanhToan((int) $maHD, $request->user()->MaTaiKhoan, [
                'maGiaoDich'  => $request->input('maGiaoDich'),
                'tenGiaoDich' => $request->input('tenGiaoDich'),
                
            ]);
        } catch (\DomainException $e) {
            return $this->loi($e);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Lỗi thanh toán.'], 500);
        }

        return response()->json(['message' => 'Thanh toán thành công!', 'data' => $hoaDon]);
    }

    public function index(Request $request): JsonResponse
    {
        // Dọn hóa đơn quá hạn, phòng khi bộ lập lịch chưa chạy
        $this->service->huyQuaHan();

        $user = $request->user();
        $query = HoaDon::with(['chiTietHoaDon', 'taiKhoan', 'khuyenMai'])->orderBy('MaHoaDon', 'desc');

        if ((int) $user->MaVaiTro === 3) {
            $query->where(function ($q) use ($user) {
                $q->where('MaTaiKhoan', $user->MaTaiKhoan)
                ->orWhere(function ($q2) {
                    $q2->where('DaHuy', false)->where('TrangThaiHoaDon', false)->where('DaGiuHang', true);
                });
            });
        }

        match ($request->query('trang_thai')) {
            'da_thanh_toan'  => $query->where('DaHuy', false)->where('TrangThaiHoaDon', true),
            'cho_thanh_toan' => $query->where('DaHuy', false)->where('TrangThaiHoaDon', false)->where('DaGiuHang', true),
            'da_huy'         => $query->where('DaHuy', true),
            default          => $query->where(function ($q) {
                $q->where('TrangThaiHoaDon', true)->orWhere('DaGiuHang', true)->orWhere('DaHuy', true);
            }),
        };

        return response()->json([
            'message' => 'Lấy danh sách hóa đơn thành công!',
            'data'    => $query->paginate(15),
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
        if ($hoaDon->DaGiuHang || $hoaDon->DaHuy) {
            return response()->json(['message' => 'Hóa đơn đang trong hàng đợi, hãy dùng chức năng hủy để hoàn kho.'], 400);
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

    public function __construct(
        private HoaDonService $service,
        private KhuyenMaiService $khuyenMai,
    ){
    }

    private function loi(\DomainException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 400);
    }

    public function chuyenVaoHangDoi(Request $request, $maHD): JsonResponse
    {
        try {
            $hoaDon = $this->service->giuHang((int) $maHD, $request->user()->MaTaiKhoan);
        } catch (\DomainException $e) {
            return $this->loi($e);
        }

        return response()->json([
            'message' => 'Đã đưa hóa đơn vào hàng đợi. Hàng được giữ trong 1 giờ.',
            'data'    => $hoaDon,
        ]);
    }

    public function huy(Request $request, $maHD): JsonResponse
    {
        $user = $request->user();
        $lyDo = trim((string) $request->input('LyDo', '')) ?: 'Khách không thanh toán';

        try {
            $hoaDon = $this->service->huy((int) $maHD, "{$lyDo} (bởi {$user->HoTen})", $user->MaTaiKhoan);
        } catch (\DomainException $e) {
            return $this->loi($e);
        }

        return response()->json(['message' => 'Đã hủy hóa đơn và hoàn lại tồn kho.', 'data' => $hoaDon]);
    }
}
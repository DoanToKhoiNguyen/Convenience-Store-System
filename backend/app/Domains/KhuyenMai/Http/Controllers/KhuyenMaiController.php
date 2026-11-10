<?php

namespace App\Domains\KhuyenMai\Http\Controllers;

use App\Domains\KhuyenMai\Services\KhuyenMaiService;
use App\Http\Controllers\Controller;
use App\Models\KhuyenMai;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class KhuyenMaiController extends Controller
{
    public function __construct(private KhuyenMaiService $service)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = KhuyenMai::withCount('hoaDon')->orderByDesc('MaKhuyenMai');

        // Nhân viên chỉ thấy chương trình đang chạy
        if ((int) $request->user()->MaVaiTro === 3) {
            $query->dangChay();
        }

        return response()->json(['data' => $query->get()->values()]);
    }

    /** Ước tính giảm giá để hiển thị trên màn hình bán hàng. Số cuối cùng do hóa đơn quyết định. */
    public function uocTinh(Request $request): JsonResponse
    {
        $data = $request->validate(['tong_tien' => 'required|numeric|min:0']);
        $tienHang = (float) $data['tong_tien'];

        ['km' => $km, 'giam' => $giam] = $this->service->timTotNhat($tienHang);

        return response()->json([
            'tong_tien_hang' => $tienHang,
            'giam'           => $giam,
            'phai_tra'       => $tienHang - $giam,
            'chuong_trinh'   => $km?->TenChuongTrinh,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $km = KhuyenMai::create($this->duLieu($request));

        return response()->json(['message' => 'Thêm chương trình khuyến mãi thành công!', 'data' => $km], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $km = KhuyenMai::find($id);
        if (!$km) {
            return response()->json(['message' => 'Không tìm thấy chương trình khuyến mãi.'], 404);
        }

        $data = $this->duLieu($request);
        if (!$request->has('TrangThai')) {
            unset($data['TrangThai']); // không gửi thì giữ nguyên
        }
        $km->update($data);

        return response()->json(['message' => 'Cập nhật chương trình khuyến mãi thành công!', 'data' => $km]);
    }

    /** Chưa áp dụng cho hóa đơn nào thì xóa, đã áp dụng thì chuyển sang tạm ngưng. */
    public function destroy($id): JsonResponse
    {
        $km = KhuyenMai::withCount('hoaDon')->find($id);
        if (!$km) {
            return response()->json(['message' => 'Không tìm thấy chương trình khuyến mãi.'], 404);
        }

        if ($km->hoa_don_count === 0) {
            $km->delete();

            return response()->json(['message' => 'Đã xóa chương trình khuyến mãi.', 'action' => 'deleted']);
        }

        $km->TrangThai = false;
        $km->save();

        return response()->json([
            'message' => 'Chương trình đã được áp dụng cho hóa đơn nên được chuyển sang tạm ngưng.',
            'action'  => 'hidden',
        ]);
    }

    public function batLai($id): JsonResponse
    {
        $km = KhuyenMai::find($id);
        if (!$km) {
            return response()->json(['message' => 'Không tìm thấy chương trình khuyến mãi.'], 404);
        }

        $km->TrangThai = true;
        $km->save();

        return response()->json(['message' => 'Đã bật lại chương trình khuyến mãi.']);
    }

    private function duLieu(Request $request): array
    {
        $d = $request->validate([
            'TenChuongTrinh' => 'required|string|max:255',
            'LoaiGiam'       => 'required|in:phan_tram,so_tien',
            'GiaTriGiam'     => 'required|numeric|min:1|max:999999999',
            'DieuKienApDung' => 'nullable|numeric|min:0',
            'GiamToiDa'      => 'nullable|numeric|min:0',
            'NgayBatDau'     => 'required|date_format:Y-m-d',
            'NgayKetThuc'    => 'required|date_format:Y-m-d|after_or_equal:NgayBatDau',
            'TrangThai'      => 'sometimes|boolean',
        ]);

        if ($d['LoaiGiam'] === 'phan_tram' && (float) $d['GiaTriGiam'] > 100) {
            throw ValidationException::withMessages([
                'GiaTriGiam' => ['Giảm theo phần trăm không được vượt quá 100.'],
            ]);
        }

        return [
            'TenChuongTrinh' => trim($d['TenChuongTrinh']),
            'LoaiGiam'       => $d['LoaiGiam'],
            'GiaTriGiam'     => $d['GiaTriGiam'],
            'DieuKienApDung' => $d['DieuKienApDung'] ?? 0,
            'GiamToiDa'      => $d['LoaiGiam'] === 'phan_tram' && !empty($d['GiamToiDa']) ? $d['GiamToiDa'] : null,
            'NgayBatDau'     => Carbon::parse($d['NgayBatDau'])->startOfDay(),
            'NgayKetThuc'    => Carbon::parse($d['NgayKetThuc'])->endOfDay(), // hết ngày 23:59 giờ Việt Nam
            'TrangThai'      => $d['TrangThai'] ?? true,
        ];
    }
}
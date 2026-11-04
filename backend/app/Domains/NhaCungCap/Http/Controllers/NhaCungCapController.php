<?php

namespace App\Domains\NhaCungCap\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\NhaCungCap;
use App\Models\PhieuNhap;
use App\Models\SanPham;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Database\QueryException;

class NhaCungCapController extends Controller
{

    private function rules($ignoreId = null): array
    {
        return [
            'TenNhaCungCap' => ['required', 'string', 'max:255',
                Rule::unique('nha_cung_cap', 'TenNhaCungCap')->ignore($ignoreId, 'MaNhaCungCap')],
            'DiaChi'        => 'required|string|max:255',
            'SoDienThoai'   => ['required', 'string', 'regex:/^[0-9+\s().-]{8,20}$/'],
        ];
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => NhaCungCap::orderBy('TenNhaCungCap')->get()->values(),
        ]);
    }

     public function store(Request $request): JsonResponse
    {
        $nhaCungCap = NhaCungCap::create($request->validate($this->rules()));

        return response()->json([
            'message' => 'Thêm nhà cung cấp thành công!',
            'data'    => $nhaCungCap,
        ], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $nhaCungCap = NhaCungCap::find($id);
        if (!$nhaCungCap) {
            return response()->json(['message' => 'Không tìm thấy nhà cung cấp.'], 404);
        }

        $nhaCungCap->update($request->validate($this->rules($id)));

        return response()->json([
            'message' => 'Cập nhật nhà cung cấp thành công!',
            'data'    => $nhaCungCap,
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $nhaCungCap = NhaCungCap::find($id);
        if (!$nhaCungCap) {
            return response()->json(['message' => 'Không tìm thấy nhà cung cấp.'], 404);
        }

        $daPhatSinh =
            SanPham::where('MaNhaCungCap', $nhaCungCap->MaNhaCungCap)->exists()
            || PhieuNhap::where('MaNhaCungCap', $nhaCungCap->MaNhaCungCap)->exists();

        if (!$daPhatSinh) {
            try {
                $nhaCungCap->delete();

                return response()->json([
                    'message' => 'Đã xóa nhà cung cấp.',
                    'action'  => 'deleted',
                ]);
            } catch (QueryException $e) {
                // Còn dữ liệu khác tham chiếu tới: chuyển sang ẩn cho an toàn
            }
        }

        $nhaCungCap->TrangThai = false;
        $nhaCungCap->save();

        return response()->json([
            'message' => 'Nhà cung cấp đã có sản phẩm hoặc phiếu nhập nên được chuyển sang trạng thái ngừng hợp tác.',
            'action'  => 'hidden',
            'data'    => $nhaCungCap,
        ]);
    }

    public function hienLai($id): JsonResponse
    {
        $nhaCungCap = NhaCungCap::find($id);
        if (!$nhaCungCap) {
            return response()->json(['message' => 'Không tìm thấy nhà cung cấp.'], 404);
        }

        $nhaCungCap->TrangThai = true;
        $nhaCungCap->save();

        return response()->json(['message' => 'Đã hợp tác lại với nhà cung cấp.', 'data' => $nhaCungCap]);
    }
}
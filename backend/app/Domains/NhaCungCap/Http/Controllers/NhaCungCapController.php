<?php

namespace App\Domains\NhaCungCap\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\DanhMuc;
use App\Models\NhaCungCap;
use App\Models\PhieuNhap;
use App\Models\SanPham;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class NhaCungCapController extends Controller
{
    private function duLieu(Request $request, $ignoreId = null): array
    {
        return $request->validate([
            'TenNhaCungCap' => ['required', 'string', 'max:255',
                Rule::unique('nha_cung_cap', 'TenNhaCungCap')->ignore($ignoreId, 'MaNhaCungCap')],
            'DiaChi'        => 'required|string|max:255',
            'SoDienThoai'   => ['required', 'string', 'regex:/^[0-9+\s().-]{8,20}$/'],
            'DanhMuc'       => 'required|array|min:1',
            'DanhMuc.*'     => 'integer|distinct|exists:danh_muc,MaDanhMuc',
        ], [
            'DanhMuc.required' => 'Vui lòng chọn ít nhất một danh mục mà nhà cung cấp này cung cấp.',
            'DanhMuc.min'      => 'Vui lòng chọn ít nhất một danh mục mà nhà cung cấp này cung cấp.',
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => NhaCungCap::with('danhMuc')->orderBy('TenNhaCungCap')->get()->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->duLieu($request);

        $nhaCungCap = DB::transaction(function () use ($data) {
            $ncc = NhaCungCap::create(Arr::only($data, ['TenNhaCungCap', 'DiaChi', 'SoDienThoai']));
            $ncc->danhMuc()->sync($data['DanhMuc']);

            return $ncc;
        });

        return response()->json([
            'message' => 'Thêm nhà cung cấp thành công!',
            'data'    => $nhaCungCap->load('danhMuc'),
        ], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $nhaCungCap = NhaCungCap::find($id);
        if (!$nhaCungCap) {
            return response()->json(['message' => 'Không tìm thấy nhà cung cấp.'], 404);
        }

        $data = $this->duLieu($request, $id);

        // Không cho bỏ danh mục mà nhà cung cấp này đang có sản phẩm
        $cu  = DB::table('nha_cung_cap_danh_muc')->where('MaNhaCungCap', $id)->pluck('MaDanhMuc')->map(fn ($v) => (int) $v);
        $moi = collect($data['DanhMuc'])->map(fn ($v) => (int) $v);
        $bo  = $cu->diff($moi)->values();

        if ($bo->isNotEmpty()) {
            $dangDung = DanhMuc::whereIn(
                'MaDanhMuc',
                SanPham::where('MaNhaCungCap', $id)->whereIn('MaDanhMuc', $bo)->select('MaDanhMuc')
            )->pluck('TenDanhMuc');

            if ($dangDung->isNotEmpty()) {
                $thongBao = 'Không thể bỏ danh mục "' . $dangDung->implode('", "')
                    . '" vì nhà cung cấp này đang có sản phẩm thuộc danh mục đó.';

                return response()->json(['message' => $thongBao, 'errors' => ['DanhMuc' => [$thongBao]]], 422);
            }
        }

        DB::transaction(function () use ($nhaCungCap, $data) {
            $nhaCungCap->update(Arr::only($data, ['TenNhaCungCap', 'DiaChi', 'SoDienThoai']));
            $nhaCungCap->danhMuc()->sync($data['DanhMuc']);
        });

        return response()->json([
            'message' => 'Cập nhật nhà cung cấp thành công!',
            'data'    => $nhaCungCap->load('danhMuc'),
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

                return response()->json(['message' => 'Đã xóa nhà cung cấp.', 'action' => 'deleted']);
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
<?php

namespace App\Domains\DanhMuc\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\DanhMuc;
use App\Models\SanPham;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DanhMucController extends Controller
{
    private function duLieu(Request $request, $ignoreId = null): array
    {
        $request->merge(['TenDanhMuc' => trim((string) $request->input('TenDanhMuc'))]);

        return $request->validate([
            'TenDanhMuc' => ['required', 'string', 'max:100',
                Rule::unique('danh_muc', 'TenDanhMuc')->ignore($ignoreId, 'MaDanhMuc')],
            'MoTa'       => 'nullable|string|max:255',
        ], [
            'TenDanhMuc.required' => 'Vui lòng nhập tên danh mục.',
            'TenDanhMuc.unique'   => 'Tên danh mục này đã tồn tại.',
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => DanhMuc::withCount('sanPham')->orderBy('TenDanhMuc')->get()->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $dm = DanhMuc::create($this->duLieu($request));

        return response()->json(['message' => 'Thêm danh mục thành công!', 'data' => $dm], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $dm = DanhMuc::find($id);
        if (!$dm) {
            return response()->json(['message' => 'Không tìm thấy danh mục.'], 404);
        }

        $data = $this->duLieu($request, $id);

        DB::transaction(function () use ($dm, $data) {
            $dm->update($data);
            // Giữ cột LoaiSanPham (tên danh mục) của các sản phẩm luôn khớp
            SanPham::where('MaDanhMuc', $dm->MaDanhMuc)->update(['LoaiSanPham' => $data['TenDanhMuc']]);
        });

        return response()->json(['message' => 'Cập nhật danh mục thành công!', 'data' => $dm]);
    }

    public function destroy($id): JsonResponse
    {
        $dm = DanhMuc::withCount('sanPham')->find($id);
        if (!$dm) {
            return response()->json(['message' => 'Không tìm thấy danh mục.'], 404);
        }

        if ($dm->san_pham_count > 0) {
            return response()->json([
                'message' => "Danh mục đang có {$dm->san_pham_count} sản phẩm. Hãy chuyển các sản phẩm sang danh mục khác trước khi xóa.",
            ], 422);
        }

        $dm->delete();

        return response()->json(['message' => 'Đã xóa danh mục.']);
    }
}
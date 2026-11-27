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

    /**
     * Sản phẩm gắn với nhà cung cấp: đang phụ trách + từng có trong phiếu nhập đã duyệt/đã nhận.
     * Phiếu chờ duyệt (1) và đã hủy (3) không tính là đã cung cấp.
     */
    public function sanPham($id): JsonResponse
    {
        $nhaCungCap = NhaCungCap::find($id);
        if (!$nhaCungCap) {
            return response()->json(['message' => 'Không tìm thấy nhà cung cấp.'], 404);
        }

        $lichSu = DB::table('chi_tiet_phieu_nhap as ct')
            ->join('phieu_nhap as pn', 'pn.MaPhieuNhap', '=', 'ct.MaPhieuNhap')
            ->where('pn.MaNhaCungCap', $id)
            ->whereIn('pn.TrangThai', [2, 4])
            ->groupBy(DB::raw('"ct"."MaSanPham"'))
            ->selectRaw('"ct"."MaSanPham", COUNT(DISTINCT "pn"."MaPhieuNhap") as so_phieu,
                SUM("ct"."SoLuong") as tong_so_luong, MAX("pn"."NgayLap") as lan_nhap_cuoi')
            ->get()
            ->keyBy('MaSanPham');

        $ds = SanPham::where('MaNhaCungCap', $id)
            ->orWhereIn('MaSanPham', $lichSu->keys())
            ->get(['MaSanPham', 'TenSanPham', 'TrangThai', 'MaNhaCungCap', 'HinhAnh'])
            ->map(function ($sp) use ($id, $lichSu) {
                $ls = $lichSu[$sp->MaSanPham] ?? null;

                return [
                    'MaSanPham'     => (int) $sp->MaSanPham,
                    'TenSanPham'    => $sp->TenSanPham,
                    'hinh_anh_url'  => $sp->hinh_anh_url,
                    'dang_ban'      => $sp->TrangThai !== false,
                    'dang_cung_cap' => (int) $sp->MaNhaCungCap === (int) $id,
                    'so_phieu'      => (int) ($ls->so_phieu ?? 0),
                    'tong_so_luong' => (int) ($ls->tong_so_luong ?? 0),
                ];
            })
            ->sortBy([['dang_cung_cap', 'desc'], ['so_phieu', 'desc'], ['TenSanPham', 'asc']])
            ->values();

        return response()->json([
            'message' => 'Lấy sản phẩm của nhà cung cấp thành công',
            'data'    => $ds,
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

        $cu  = DB::table('nha_cung_cap_danh_muc')->where('MaNhaCungCap', $id)->pluck('MaDanhMuc')->map(fn ($v) => (int) $v);
        $moi = collect($data['DanhMuc'])->map(fn ($v) => (int) $v);
        $bo  = $cu->diff($moi)->values();

        // Chỉ sản phẩm đang kinh doanh mới chặn bỏ danh mục; sản phẩm đã ngừng bán thì bỏ được
        if ($bo->isNotEmpty()) {
            $dangBan = [];
            foreach (DanhMuc::whereIn('MaDanhMuc', $bo)->get() as $dm) {
                $ten = SanPham::where('MaNhaCungCap', $id)
                    ->where(fn ($q) => $q->whereNull('TrangThai')->orWhere('TrangThai', true))
                    ->where(function ($q) use ($dm) {
                        $q->where('MaDanhMuc', $dm->MaDanhMuc)
                            // Sản phẩm tạo trước khi có cột MaDanhMuc chỉ còn tên danh mục ở LoaiSanPham
                            ->orWhere(fn ($q2) => $q2->whereNull('MaDanhMuc')->where('LoaiSanPham', $dm->TenDanhMuc));
                    })
                    ->orderBy('TenSanPham')
                    ->pluck('TenSanPham');

                if ($ten->isNotEmpty()) {
                    $dangBan[] = 'danh mục "' . $dm->TenDanhMuc . '" (sản phẩm: ' . $ten->implode(', ') . ')';
                }
            }

            if ($dangBan) {
                $thongBao = 'Không thể bỏ ' . implode('; ', $dangBan)
                    . ' vì nhà cung cấp này còn sản phẩm đang kinh doanh thuộc danh mục đó.';

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
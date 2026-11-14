<?php

namespace App\Domains\SanPham\Http\Controllers;

use Illuminate\Validation\Rule;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\SanPham;
use App\Models\CapNhatTonKho;
use App\Models\PhieuNhap;
use App\Models\ChiTietPhieuNhap;
use App\Models\NhaCungCap;
use App\Models\DanhMuc;
use Illuminate\Support\Facades\DB;
use Nette\Schema\Message;
use App\Models\ChiTietHoaDon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use App\Domains\LoHang\Services\LoHangService;
use App\Models\LoHang;

class SanPhamController extends Controller
{
    private function rules($ignoreId = null): array
    {
        return [
            'TenSanPham'     => ['required', 'string', 'max:255',
                Rule::unique('san_pham', 'TenSanPham')->ignore($ignoreId, 'MaSanPham')],
            'MaDanhMuc'      => 'required|exists:danh_muc,MaDanhMuc',
            'TenThuongHieu'  => 'nullable|string|max:100',
            'MaNhaCungCap'   => 'required|exists:nha_cung_cap,MaNhaCungCap',
            'DonGiaBan'      => 'required|numeric|min:0',
            'DonGiaNhap'     => 'required|numeric|min:0',
            'TonKhoToiThieu' => 'required|integer|min:0',
            'TonKhoToiDa'    => 'nullable|integer|min:0|gte:TonKhoToiThieu',
            'CanhBaoHSD'     => 'nullable|integer|min:0',
            'MoTa'           => 'nullable|string',
            'ThanhPhan'      => 'nullable|string',
            'TienToLo' => ['nullable', 'string', 'regex:/^[A-Z0-9]{1,10}$/',
            Rule::unique('san_pham', 'TienToLo')->ignore($ignoreId, 'MaSanPham')],
        ];
    }

    public function store(Request $request, LoHangService $loHang): JsonResponse
    {
        $this->chuanHoaTienTo($request);

        $data = $request->validate($this->rules() + [
            'SoLuongHienTai'  => 'nullable|integer|min:0',
            'HanSuDungBanDau' => 'nullable|date_format:Y-m-d|after_or_equal:today',
        ], $this->thongBaoTienTo());

        if (!NhaCungCap::where('MaNhaCungCap', $data['MaNhaCungCap'])->where('TrangThai', true)->exists()) {
            return response()->json([
                'message' => 'Nhà cung cấp đã ngừng hợp tác.',
                'errors'  => ['MaNhaCungCap' => ['Nhà cung cấp đã ngừng hợp tác.']],
            ], 422);
        }

        $soLuongBanDau = (int) ($data['SoLuongHienTai'] ?? 0);
        $hanBanDau = $data['HanSuDungBanDau'] ?? null;
        unset($data['HanSuDungBanDau']);

        if (!empty($data['TonKhoToiDa']) && $soLuongBanDau > $data['TonKhoToiDa']) {
            return response()->json([
                'message' => 'Số lượng ban đầu vượt quá mức tồn kho tối đa.',
                'errors'  => ['SoLuongHienTai' => ['Số lượng ban đầu vượt quá mức tồn kho tối đa.']],
            ], 422);
        }

        $data['SoLuongHienTai'] = 0; // số lượng ban đầu được cộng qua lô, để tồn kho khớp tổng các lô
        $data['TrangThai'] = true;
        $data['LoaiSanPham'] = DanhMuc::find($data['MaDanhMuc'])->TenDanhMuc;
        $data['TienToLo'] = $data['TienToLo'] ?? $loHang->goiYTienTo($data['TenSanPham']);

        $sanPham = DB::transaction(function () use ($data, $soLuongBanDau, $hanBanDau, $request, $loHang) {
            $sp = SanPham::create($data);

            if ($soLuongBanDau > 0) {
                $loHang->nhapLo($sp->MaSanPham, $soLuongBanDau, $hanBanDau, 'Khởi tạo sản phẩm', $request->user()->MaTaiKhoan);
            }

            return $sp->fresh();
        });

        return response()->json(['message' => 'Thêm sản phẩm thành công!', 'data' => $sanPham], 201);
    }

    public function update(Request $request, $id, LoHangService $loHang): JsonResponse
    {
        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $this->chuanHoaTienTo($request);
        $data = $request->validate($this->rules($id), $this->thongBaoTienTo());

        if ((int) $data['MaNhaCungCap'] !== (int) $sanPham->MaNhaCungCap
            && !NhaCungCap::where('MaNhaCungCap', $data['MaNhaCungCap'])->where('TrangThai', true)->exists()) {
            return response()->json([
                'message' => 'Nhà cung cấp đã ngừng hợp tác.',
                'errors'  => ['MaNhaCungCap' => ['Nhà cung cấp đã ngừng hợp tác.']],
            ], 422);
        }

        $tienTo = $data['TienToLo'] ?? $sanPham->TienToLo
            ?? $loHang->goiYTienTo($data['TenSanPham'], (int) $sanPham->MaSanPham);

        if ($sanPham->TienToLo !== null && $tienTo !== $sanPham->TienToLo
            && LoHang::where('MaSanPham', $sanPham->MaSanPham)->exists()) {
            return response()->json([
                'message' => 'Sản phẩm đã có lô hàng nên không đổi được tiền tố mã lô.',
                'errors'  => ['TienToLo' => ['Sản phẩm đã có lô hàng nên không đổi được tiền tố mã lô.']],
            ], 422);
        }

        $data['TienToLo'] = $tienTo;
        $data['LoaiSanPham'] = DanhMuc::find($data['MaDanhMuc'])->TenDanhMuc;
        $sanPham->update($data);

        return response()->json(['success' => true, 'message' => 'Cập nhật sản phẩm thành công!', 'data' => $sanPham], 200);
    }

    public function search(Request $request): JsonResponse
    {
        // Nhận tham số 'q' từ query string do Angular truyền lên (hoặc fallback sang 'keyword' nếu có)
        $keyword = $request->query('q') ?? $request->query('keyword');

        $query = SanPham::query();

        if (!empty($keyword)) {
            $query->where('TrangThai', true)->where(function ($q) use ($keyword) {
                    $q->where('TenSanPham', 'LIKE', '%' . $keyword . '%')
                    ->orWhere('MaSanPham', 'LIKE', '%' . $keyword . '%');
                });
        } else {
            // Nếu không truyền từ khóa hoặc từ khóa rỗng, có thể trả về danh sách trống hoặc toàn bộ tuỳ ý.
            // Để phục vụ tìm kiếm gợi ý, nếu trống ta trả về mảng rỗng thay vì báo lỗi 404 để không làm gián đoạn UI.
            return response()->json([
                'message' => 'Không tìm thấy sản phẩm!',
                'data'    => []
            ], 200);
        }

        $danhSach = $query->get();

        return response()->json([
            'message' => 'Tra cứu sản phẩm thành công!',
            'data'    => $danhSach
        ]);
    }

    public function show($id) : JsonResponse
    {
        $sanPham = SanPham::find($id);

        if (!$sanPham) {
            return response()->json([
                'message' => 'Không tìm thấy sản phẩm!'
            ], 404); // Mã 404 Not Found
        }

        return response()->json([
            'data' => $sanPham
        ]);
    }

    public function index(Request $request, LoHangService $loHang): JsonResponse
    {
        $user = $request->user('sanctum');
        $quanLy = $user && in_array((int) $user->MaVaiTro, [1, 2], true);

        $query = SanPham::query();
        if (!$quanLy) {
            $query->where(fn ($q) => $q->where('TrangThai', true)->orWhereNull('TrangThai'));
        }

        if ($user) {
            $query->with(['loHang' => fn ($q) => $q->where('SoLuongCon', '>', 0)
                ->orderByRaw('"HanSuDung" IS NULL')
                ->orderBy('HanSuDung')
                ->orderBy('MaLoHang')]);
        }

        $data = $query->get()
            ->map(fn (SanPham $sp) => $user ? $loHang->kemThongTinHsd($sp) : $sp->toArray())
            ->values();

        return response()->json(['data' => $data]);
    }


    public function danhSachCanhBao()
    {
        $pn = (new PhieuNhap)->getTable();
        $ct = (new ChiTietPhieuNhap)->getTable();

        // Tổng số lượng đang nằm trong phiếu CHỜ DUYỆT (1) và ĐÃ DUYỆT (2), chưa nhận hàng
        $dangNhap = DB::table("$ct as ct")
            ->join("$pn as pn", 'pn.MaPhieuNhap', '=', 'ct.MaPhieuNhap')
            ->whereIn('pn.TrangThai', [1, 2])
            ->groupBy(DB::raw('"ct"."MaSanPham"')) // 👈 Thêm ngoặc kép chống lỗi hoa/thường của PostgreSQL
            ->selectRaw('"ct"."MaSanPham", SUM("ct"."SoLuong") as tong') // 👈 Thêm ngoặc kép ở đây nữa
            ->pluck('tong', 'MaSanPham');

        $sanPhams = SanPham::with('nhaCungCap')
            ->where('TrangThai', true)
            ->whereColumn('SoLuongHienTai', '<=', 'TonKhoToiThieu')
            ->get()
            ->each(fn ($sp) => $sp->SoLuongDangNhap = (int) ($dangNhap[$sp->MaSanPham] ?? 0))
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách cảnh báo tồn kho thành công',
            'data'    => $sanPhams,
        ], 200);
    }


    public function destroy($id): JsonResponse
    {
        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $daPhatSinh =
            ChiTietHoaDon::where('MaSanPham', $sanPham->MaSanPham)->exists()
            || ChiTietPhieuNhap::where('MaSanPham', $sanPham->MaSanPham)->exists();

        if (!$daPhatSinh) {
            try {
                $sanPham->delete();

                return response()->json([
                    'message' => 'Đã xóa sản phẩm.',
                    'action'  => 'deleted',
                ]);
            } catch (QueryException $e) {
                // Còn dữ liệu khác tham chiếu tới sản phẩm: chuyển sang ẩn cho an toàn
            }
        }

        $sanPham->TrangThai = false;
        $sanPham->save();

        return response()->json([
            'message' => 'Sản phẩm đã có trong hóa đơn hoặc phiếu nhập nên được chuyển sang trạng thái ẩn.',
            'action'  => 'hidden',
            'data'    => $sanPham,
        ]);
    }

    public function hienLai($id): JsonResponse
    {
        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $sanPham->TrangThai = true;
        $sanPham->save();

        return response()->json(['message' => 'Đã hiển thị lại sản phẩm.', 'data' => $sanPham]);
    }

    public function capNhatTonKho(Request $request, LoHangService $loHang, $maSanPham): JsonResponse
    {
        $validated = $request->validate([
            'SoLuongMoi'  => 'required|integer|min:0',
            'LyDoCapNhat' => 'required|string|max:200',
            'MaLoHang'    => 'nullable|integer',
        ]);

        try {
            $sanPham = DB::transaction(fn () => $loHang->capNhatThuCong(
                (int) $maSanPham,
                (int) $validated['SoLuongMoi'],
                $validated['MaLoHang'] ?? null,
                $validated['LyDoCapNhat'],
                $request->user()->MaTaiKhoan
            ));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 400);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Lỗi cập nhật tồn kho',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        return response()->json([
            'message' => 'Cập nhật số lượng tồn kho và ghi lịch sử thành công!',
            'data'    => ['sanPham' => $sanPham],
        ]);
    }

    public function danhSachLichSuTonKho(Request $request): JsonResponse
    {
        $lichSu = CapNhatTonKho::with(['sanPham', 'taiKhoan'])
            ->orderByDesc('MaCapNhat')
            ->limit(300)
            ->get()
            ->values();

        return response()->json([
            'message' => 'Lấy lịch sử tồn kho thành công!',
            'data'    => $lichSu,
        ]);
    }

    public function taiHinhAnh(Request $request, $id): JsonResponse
    {
        $request->validate([
            'HinhAnh' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048', // tối đa 2 MB
        ]);

        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $duongDan = $request->file('HinhAnh')->store('san-pham', 'public');
        $cu = $sanPham->HinhAnh;

        $sanPham->HinhAnh = $duongDan;
        $sanPham->save();

        if ($cu) {
            Storage::disk('public')->delete($cu);
        }

        return response()->json(['message' => 'Đã cập nhật ảnh sản phẩm.', 'data' => $sanPham]);
    }

    public function xoaHinhAnh($id): JsonResponse
    {
        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        if ($sanPham->HinhAnh) {
            Storage::disk('public')->delete($sanPham->HinhAnh);
        }
        $sanPham->HinhAnh = null;
        $sanPham->save();

        return response()->json(['message' => 'Đã xóa ảnh sản phẩm.']);
    }

    private function chuanHoaTienTo(Request $request): void
    {
        if ($request->filled('TienToLo')) {
            $request->merge(['TienToLo' => strtoupper(trim((string) $request->input('TienToLo')))]);
        }
    }

    private function thongBaoTienTo(): array
    {
        return [
            'TienToLo.regex'  => 'Tiền tố chỉ gồm chữ không dấu và số, tối đa 10 ký tự.',
            'TienToLo.unique' => 'Tiền tố này đã được sản phẩm khác dùng.',
        ];
    }
}
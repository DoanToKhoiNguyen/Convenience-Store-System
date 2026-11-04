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
use Illuminate\Support\Facades\DB;
use Nette\Schema\Message;
use App\Models\ChiTietHoaDon;
use Illuminate\Database\QueryException;

class SanPhamController extends Controller
{
    private function rules($ignoreId = null): array
    {
        return [
            'TenSanPham'     => ['required', 'string', 'max:255',
                Rule::unique('san_pham', 'TenSanPham')->ignore($ignoreId, 'MaSanPham')],
            'LoaiSanPham'    => 'nullable|string|max:100',
            'TenThuongHieu'  => 'nullable|string|max:100',
            'MaNhaCungCap'   => 'required|exists:nha_cung_cap,MaNhaCungCap',
            'DonGiaBan'      => 'required|numeric|min:0',
            'DonGiaNhap'     => 'required|numeric|min:0',
            'TonKhoToiThieu' => 'required|integer|min:0',
            'TonKhoToiDa'    => 'nullable|integer|min:0|gte:TonKhoToiThieu',
            'CanhBaoHSD'     => 'nullable|integer|min:0',
            'MoTa'           => 'nullable|string',
            'ThanhPhan'      => 'nullable|string',
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules() + [
            'SoLuongHienTai' => 'nullable|integer|min:0',
        ]);

        if (!NhaCungCap::where('MaNhaCungCap', $data['MaNhaCungCap'])->where('TrangThai', true)->exists()) {
            return response()->json([
                'message' => 'Nhà cung cấp đã ngừng hợp tác.',
                'errors'  => ['MaNhaCungCap' => ['Nhà cung cấp đã ngừng hợp tác.']],
            ], 422);
        }

        $soLuongBanDau = (int) ($data['SoLuongHienTai'] ?? 0);
        $data['SoLuongHienTai'] = $soLuongBanDau;

        if (!empty($data['TonKhoToiDa']) && $soLuongBanDau > $data['TonKhoToiDa']) {
            return response()->json([
                'message' => 'Số lượng ban đầu vượt quá mức tồn kho tối đa.',
                'errors'  => ['SoLuongHienTai' => ['Số lượng ban đầu vượt quá mức tồn kho tối đa.']],
            ], 422);
        }

        $sanPham = DB::transaction(function () use ($data, $soLuongBanDau, $request) {
            $sp = SanPham::create($data);

            if ($soLuongBanDau > 0) {
                CapNhatTonKho::create([
                    'ThoiGianCapNhat' => now(),
                    'SoLuongMoi'      => $soLuongBanDau,
                    'SoLuongHienTai'  => 0, // số lượng trước đó, theo cách bạn đang ghi lịch sử
                    'LyDoCapNhat'     => 'Khởi tạo sản phẩm',
                    'MaTaiKhoan'      => $request->user()->MaTaiKhoan,
                    'MaSanPham'       => $sp->MaSanPham,
                ]);
            }

            return $sp;
        });

        return response()->json(['message' => 'Thêm sản phẩm thành công!', 'data' => $sanPham], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $sanPham = SanPham::find($id);
        if (!$sanPham) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $data = $request->validate($this->rules($id));

        // Kiểm tra nếu đổi nhà cung cấp mới mà nhà cung cấp đó đã ngừng hợp tác (TrangThai = false)
        if ((int) $data['MaNhaCungCap'] !== (int) $sanPham->MaNhaCungCap
            && !NhaCungCap::where('MaNhaCungCap', $data['MaNhaCungCap'])->where('TrangThai', true)->exists()) {
            return response()->json([
                'message' => 'Nhà cung cấp đã ngừng hợp tác.',
                'errors'  => ['MaNhaCungCap' => ['Nhà cung cấp đã ngừng hợp tác.']],
            ], 422);
        }

        // Cập nhật dữ liệu một lần duy nhất
        $sanPham->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật sản phẩm thành công!', 
            'data'    => $sanPham
        ], 200);
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

    public function index(Request $request): JsonResponse
{
    $query = SanPham::query();

    $user = $request->user('sanctum'); // route này công khai nên đọc token thủ công
    $quanLy = $user && in_array((int) $user->MaVaiTro, [1, 2], true);

    if (!$quanLy) {
        $query->where('TrangThai', true);
    }

    return response()->json(['data' => $query->get()]);
}

    public function capNhatTonKho(Request $request, $sanPham): JsonResponse
    {
        $validated = $request->validate([
            'SoLuongMoi' => 'required|Integer',
            'LyDoCapNhat' => 'required|string'
        ]);

        $sanPham = SanPham::where('MaSanPham', $sanPham)->first();

        if(!$sanPham){
            return response()->json([
                'message' => 'Không tìm thấy sản phẩm'
            ], 404);
        }

        DB::beginTransaction();
        try{
            // Lưu lại số lượng tồn kho cũ trước khi thay đổi
            $soLuongHienTaiCu = $sanPham->SoLuongHienTai;
            
            // Tính số lượng mới sau khi cộng dồn (hoặc thay đổi)
            $soLuongMoi = $validated['SoLuongMoi'];

            // Kiểm tra không cho phép tồn kho âm
            if ($soLuongMoi < 0) {
                return response()->json(['message' => 'Số lượng tồn kho sau khi cập nhật không được nhỏ hơn 0.'], 400);
            }

            if ($sanPham->TonKhoToiDa && $soLuongMoi > $sanPham->TonKhoToiDa) {
                return response()->json([
                    'message' => "Số lượng tồn kho vượt quá mức tối đa cho phép ({$sanPham->TonKhoToiDa})."
                ], 400);
            }
            // 1. Cập nhật số lượng mới vào bảng SAN_PHAM
            $sanPham->SoLuongHienTai = $soLuongMoi;
            $sanPham->save();

            // 2. Ghi lịch sử vào bảng CAP_NHAT_TON_KHO
            $lichSu = CapNhatTonKho::create([
                'ThoiGianCapNhat' => now(),
                'SoLuongMoi'      => $soLuongMoi,
                'SoLuongHienTai'  => $soLuongHienTaiCu, 
                'LyDoCapNhat'     => $validated['LyDoCapNhat'],
                'MaTaiKhoan'      => $request->user()->MaTaiKhoan,
                'MaSanPham'       => $sanPham->MaSanPham,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Cập nhật số lượng tồn kho và ghi lịch sử thành công!',
                'data'    => [
                    'sanPham' => $sanPham,
                    'lichSu'  => $lichSu
                ]
            ]);
        }
        catch(\Exception $e)
        {
            DB::rollBack();
            return response()->json([
                'message' => 'Lỗi cập nhật tồn kho',
                'error' => $e->getMessage()
            ], 500);
        }
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

    public function danhSachLichSuTonKho(Request $request): JsonResponse
    {
        $lichSu = CapNhatTonKho::with(['sanPham', 'taiKhoan'])
                    ->orderBy('MaCapNhat', 'desc')
                    ->get();

        return response()->json([
            'message' => 'Lấy lịch sử tồn kho thành công!',
            'data'    => $lichSu
        ]);
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
}
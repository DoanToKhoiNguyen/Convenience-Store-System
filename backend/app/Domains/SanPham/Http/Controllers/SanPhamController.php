<?php

namespace App\Domains\SanPham\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\SanPham;
use App\Models\CapNhatTonKho;
use App\Models\PhieuNhap;
use App\Models\ChiTietPhieuNhap;
use Illuminate\Support\Facades\DB;
use Nette\Schema\Message;

class SanPhamController extends Controller
{
    /**
     * Tra cứu sản phẩm theo tên hoặc mã (Role 1, 2, 3 đều dùng được)
     */
    /**
     * Tra cứu sản phẩm theo tên hoặc mã (Role 1, 2, 3 đều dùng được)
     */
    public function search(Request $request): JsonResponse
    {
        // Nhận tham số 'q' từ query string do Angular truyền lên (hoặc fallback sang 'keyword' nếu có)
        $keyword = $request->query('q') ?? $request->query('keyword');

        $query = SanPham::query();

        if (!empty($keyword)) {
            $query->where('TenSanPham', 'LIKE', '%' . $keyword . '%')
                  ->orWhere('MaSanPham', 'LIKE', '%' . $keyword . '%');
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
        $danhSach = SanPham::all();

        return response()->json([
            'data' => $danhSach
        ]);
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
}
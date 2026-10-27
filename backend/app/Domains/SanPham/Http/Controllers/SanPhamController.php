<?php

namespace App\Domains\SanPham\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\SanPham;
use App\Models\CapNhatTonKho;
use Illuminate\Support\Facades\DB;
use Nette\Schema\Message;

class SanPhamController extends Controller
{
    /**
     * Tra cứu sản phẩm theo tên hoặc mã (Role 1, 2, 3 đều dùng được)
     */
    public function search(Request $request): JsonResponse
    {
        // Lấy từ khóa truyền lên từ query string (Ví dụ: /api/san-pham/tra-cuu?keyword=cocacola)
        $keyword = $request->query('keyword');

        $query = SanPham::query();

        if (!empty($keyword)) {
            $query->where('TenSanPham', 'LIKE', '%' . $keyword . '%')
                  ->orWhere('MaSanPham', 'LIKE', '%' . $keyword . '%');
        }
        if(empty($keyword)){
            return response()->json([
                'message' => 'Không tim thấy sản phẩm!'
            ], 404);
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
        $sanPhams = SanPham::with('nhaCungCap')
            ->whereColumn('SoLuongHienTai', '<=', 'TonKhoToiThieu')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách cảnh báo tồn kho thành công',
            'data' => $sanPhams
        ], 200);
    }
}
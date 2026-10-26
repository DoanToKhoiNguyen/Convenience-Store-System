<?php

namespace App\Domains\SanPham\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\SanPham; // Model sản phẩm của bạn

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
}
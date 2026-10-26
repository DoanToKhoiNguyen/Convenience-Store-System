<?php

namespace App\Domains\NhanVien\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\TaiKhoan;
use Illuminate\Support\Facades\Hash;

class NhanVienController extends Controller
{
    /**
     * Lấy danh sách nhân viên
     */
    public function index(Request $request): JsonResponse
    {
        // Sau này bạn sẽ gọi Model để lấy dữ liệu thực tế từ Database
        $danhSach = TaiKhoan::all();

        return response()->json([
            'message' => 'Lấy danh sách nhân viên thành công!',
            'data' => $danhSach, // Thay bằng $danhSach sau khi có bảng
        ]);
    }

    /**
     * Xem chi tiết một nhân viên theo ID
     */
    public function show($id): JsonResponse
    {
        // $nhanVien = NhanVien::find($id);
        // if (!$nhanVien) {
        //     return response()->json(['message' => 'Không tìm thấy nhân viên.'], 404);
        // }

        return response()->json([
            'message' => 'Lấy chi tiết nhân viên thành công!',
            'data' => ['id' => $id]
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        // Kiểm tra dữ liệu đầu vào
        $validated = $request->validate([
            'TenDangNhap' => 'required|string|unique:tai__khoan,TenDangNhap',
            'MatKhau'     => 'required|string|min:6',
            'HoTen'       => 'required|string',
            'Email'       => 'required|string',
            'SoDienThoai' => 'required|string',
            'MaVaiTro'    => 'required|integer',
        ]);

        // Tạo mới nhân viên và mã hóa mật khẩu bảo mật
        $nhanVien = TaiKhoan::create([
            'TenDangNhap' => $validated['TenDangNhap'],
            'MatKhau'     => Hash::make($validated['MatKhau']),
            'HoTen'       => $validated['HoTen'],
            'Email'       => $validated['Email'],
            'SoDienThoai' => $validated['SoDienThoai'],
            'TrangThai' => true, 
            'MaVaiTro'    => $validated['MaVaiTro'],
        ]);

        return response()->json([
            'message' => 'Thêm nhân viên thành công!',
            'data' => $nhanVien
        ], 201); 
    }
    
    public function update(Request $request, $id): JsonResponse
    {
        $nhanVien = TaiKhoan::find($id);

        if(!$nhanVien){
            return response()->json([
                'message' =>'Không tìm thấy nhân viên.'
            ], 404);
        }

         $validated = $request->validate([
            'TenDangNhap' => 'sometimes|required|string|unique:tai__khoan,TenDangNhap,' . $id . ',MaTaiKhoan',
            'TrangThai'   => 'sometimes|boolean',
            'MaVaiTro'    => 'sometimes|required|integer',
        ]);

        $dataToUpdate = [
            'TenDangNhap' => $validated['TenDangNhap'] ?? $nhanVien->TenDangNhap,
            'TrangThai'   => $validated['TrangThai'] ?? $nhanVien->TrangThai,
            'MaVaiTro'    => $validated['MaVaiTro'] ?? $nhanVien->MaVaiTro,
        ];

        $nhanVien->update($dataToUpdate);
        return response()->json([
            'message' => 'Cập nhật thông tin nhân viên thành công!',
            'data'    => $nhanVien
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $nhanVien = TaiKhoan::find($id);

        if (!$nhanVien) {
            return response()->json([
                'message' => 'Không tìm thấy nhân viên cần xóa.'
            ], 404);
        }

        $nhanVien->delete();

        return response()->json([
            'message' => 'Xóa nhân viên thành công!',
            'id' => $id
        ]);
    }
}
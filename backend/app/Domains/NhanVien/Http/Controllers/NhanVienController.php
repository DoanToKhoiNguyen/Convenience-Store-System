<?php

namespace App\Domains\NhanVien\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\TaiKhoan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

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
    $validated = $request->validate([
        'TenDangNhap' => 'required|string|unique:tai__khoan,TenDangNhap',
        'MatKhau'     => 'required|string|min:6',
        'HoTen'       => 'required|string|max:255',
        'Email'       => 'required|email|unique:tai__khoan,Email',
        'SoDienThoai' => 'nullable|string|max:20',
        'MaVaiTro'    => 'required|integer|in:1,2,3',
    ]);

    $nhanVien = TaiKhoan::create([
        ...$validated,
        'MatKhau'   => Hash::make($validated['MatKhau']),
        'TrangThai' => true,
    ]);

    return response()->json(['message' => 'Thêm nhân viên thành công!', 'data' => $nhanVien], 201);
}

public function update(Request $request, $id): JsonResponse
{
    $nhanVien = TaiKhoan::find($id);
    if (!$nhanVien) {
        return response()->json(['message' => 'Không tìm thấy nhân viên.'], 404);
    }

    $validated = $request->validate([
        'HoTen'       => 'sometimes|required|string|max:255',
        'Email'       => ['sometimes', 'required', 'email',
            Rule::unique('tai__khoan', 'Email')->ignore($id, 'MaTaiKhoan')],
        'SoDienThoai' => 'sometimes|nullable|string|max:20',
        'MaVaiTro'    => 'sometimes|required|integer|in:1,2,3',
        'TrangThai'   => 'sometimes|boolean',
    ]);

    // Không cho tự khóa hoặc tự đổi vai trò của chính mình
    if ($request->user()->MaTaiKhoan == $nhanVien->MaTaiKhoan) {
        if (array_key_exists('TrangThai', $validated) && !$validated['TrangThai']) {
            return response()->json(['message' => 'Bạn không thể tự khóa tài khoản của mình.'], 400);
        }
        if (isset($validated['MaVaiTro']) && (int) $validated['MaVaiTro'] !== (int) $nhanVien->MaVaiTro) {
            return response()->json(['message' => 'Bạn không thể tự đổi vai trò của mình.'], 400);
        }
    }

    $nhanVien->update($validated);

    // Khóa hoặc đổi vai trò: thu hồi mọi token, buộc họ đăng nhập lại
    $biKhoa = array_key_exists('TrangThai', $validated) && !$validated['TrangThai'];
    $doiVaiTro = isset($validated['MaVaiTro']) && $nhanVien->wasChanged('MaVaiTro');
    if ($biKhoa || $doiVaiTro) {
        $nhanVien->tokens()->delete();
    }

    return response()->json(['message' => 'Cập nhật thành công!', 'data' => $nhanVien]);
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
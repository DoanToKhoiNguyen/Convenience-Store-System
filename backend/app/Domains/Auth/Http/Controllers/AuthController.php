<?php

namespace App\Domains\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TaiKhoan;
use App\Domains\Auth\Http\Requests\LoginRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        // Tìm tài khoản theo tên đăng nhập
        $taiKhoan = TaiKhoan::where('TenDangNhap', $request->TenDangNhap)->first();

        // Kiểm tra tài khoản và mật khẩu mã hóa
        if (!$taiKhoan || !Hash::check($request->MatKhau, $taiKhoan->MatKhau)) {
            return response()->json([
                'message' => 'Tên đăng nhập hoặc mật khẩu không chính xác.'
            ], 401);
        }

        if (!$taiKhoan->TrangThai) {
            return response()->json([
                'message' => 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'
            ], 403); // Mã 403 Forbidden
        }

        // Tạo Token cho tài khoản
        $token = $taiKhoan->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Đăng nhập thành công!',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $taiKhoan
        ]);
    }

    // Đăng xuất (Thu hồi token hiện tại)
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Đăng xuất thành công.'
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $taiKhoan = $request->user();

        return response()->json([
            'user' => [
                'id' => $taiKhoan->id,
                'TenDangNhap' => $taiKhoan->TenDangNhap,
                'HoTen' => $taiKhoan->HoTen,
                'Email' => $taiKhoan->Email,
                'SoDienThoai' => $taiKhoan->SoDienThoai,
                'TrangThai' => $taiKhoan->TrangThai
            ]
        ]);
    }
}

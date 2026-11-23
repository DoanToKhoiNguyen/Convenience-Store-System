<?php

namespace App\Domains\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TaiKhoan;
use App\Domains\Auth\Http\Requests\LoginRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
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

        return response()->json(['user' => $request->user()]);
    }
    public function capNhatThongTin(Request $request): JsonResponse
{
    $user = $request->user();

    // Chỉ nhận 3 trường này. MaVaiTro, TrangThai, TenDangNhap có gửi lên cũng bị bỏ qua.
    $validated = $request->validate([
        'HoTen'       => 'required|string|max:255',
        'Email'       => ['required', 'email',
            Rule::unique('tai__khoan', 'Email')->ignore($user->MaTaiKhoan, 'MaTaiKhoan')],
        'SoDienThoai' => 'nullable|string|max:20',
    ]);

    $user->update($validated);

    return response()->json([
        'message' => 'Cập nhật thông tin cá nhân thành công!',
        'user'    => $user->fresh(),
    ]);
}

public function doiMatKhau(Request $request): JsonResponse
{
    $user = $request->user();

    $validated = $request->validate([
        'MatKhauCu'      => 'required|string',
        'MatKhauMoi'     => 'required|string|min:6|different:MatKhauCu',
        'NhapLaiMatKhau' => 'required|same:MatKhauMoi',
    ]);

    if (! Hash::check($validated['MatKhauCu'], $user->MatKhau)) {
        return response()->json([
            'message' => 'Mật khẩu hiện tại không đúng.',
            'errors'  => ['MatKhauCu' => ['Mật khẩu hiện tại không đúng.']],
        ], 422);
    }

    $user->update(['MatKhau' => Hash::make($validated['MatKhauMoi'])]);

    // Đăng xuất các thiết bị khác, giữ lại phiên hiện tại
    $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

    return response()->json(['message' => 'Đổi mật khẩu thành công!']);
}   
}

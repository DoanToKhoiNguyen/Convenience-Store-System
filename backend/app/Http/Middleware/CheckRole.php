<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();

        // Kiểm tra xem user đã đăng nhập và có VaiTro nằm trong danh sách cho phép không
        // Giả sử cột vai trò trong bảng TaiKhoan/NhanVien của bạn tên là 'VaiTro' hoặc 'Role'
        if (!$user || !in_array($user->MaVaiTro, $roles)) {
            return response()->json([
                'message' => 'Bạn không có quyền truy cập tính năng này.'
            ], 403); // 403 Forbidden
        }
        return $next($request);
    }
}

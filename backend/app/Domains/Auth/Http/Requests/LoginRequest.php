<?php

namespace App\Domains\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    /**
     * Xác định xem người dùng có quyền thực hiện request này không.
     */
    public function authorize(): bool
    {
        return true; // Ai cũng có quyền gửi request đăng nhập
    }

    /**
     * Các quy tắc validate dữ liệu đầu vào.
     */
    public function rules(): array
    {
        return [
            'TenDangNhap' => 'required|string',
            'MatKhau' => 'required|string',
        ];
    }

    /**
     * Tùy chỉnh thông báo lỗi (tùy chọn).
     */
    public function messages(): array
    {
        return [
            'TenDangNhap.required' => 'Vui lòng nhập tên đăng nhập.',
            'MatKhau.required' => 'Vui lòng nhập mật khẩu.',
        ];
    }
}
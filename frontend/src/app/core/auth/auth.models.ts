export interface AuthUser {
    MaTaiKhoan: number;
    TenDangNhap: string;
    HoTen: string;
    Email: string | null;
    SoDienThoai?: string | null;
    TrangThai?: number | string;
    MaVaiTro: number;
    roles?: string[];
    permissions?: string[];
}
export interface ProfilePayload {
    HoTen: string;
    Email: string;
    SoDienThoai: string | null;
}

export interface PasswordPayload {
    MatKhauCu: string;
    MatKhauMoi: string;
    NhapLaiMatKhau: string;
}
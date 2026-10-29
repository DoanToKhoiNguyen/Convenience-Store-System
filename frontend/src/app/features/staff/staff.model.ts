export interface Staff {
    MaTaiKhoan: number;
    TenDangNhap: string;
    HoTen: string;
    Email: string;
    SoDienThoai: string | null;
    TrangThai: boolean | number;
    MaVaiTro: number | string;
}

export interface StaffPayload {
    TenDangNhap?: string;
    HoTen?: string;
    Email?: string;
    SoDienThoai?: string | null;
    MaVaiTro?: number;
    TrangThai?: boolean;
    MatKhau?: string;
}
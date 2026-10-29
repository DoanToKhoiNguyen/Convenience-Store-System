export interface SanPham {
    MaSanPham?: number;
    TenSanPham: string;
    DonGiaBan?: number;
    SoLuongHienTai?: number;
}

export interface ChiTietHoaDon {
    maCTHD?: number;
    MaHoaDon: number;
    MaSanPham: number;
    TenSanPham: string;
    SoLuong: number;
    ThanhTien: number;
    sanPham?: SanPham;
}

export interface HoaDon {
    MaHoaDon: number;
    NgayLap: string;
    TrangThaiHoaDon: boolean; // false: chưa thanh toán, true: đã thanh toán
    TongTien: number;
    MaTaiKhoan: number;
    MaGiaoDich?: string;
    TenGiaoDich?: string;
    TienGiamGia?: number;
    chi_tiet_hoa_don?: ChiTietHoaDon[];
}

export interface ApiResponse<T> {
    message: string;
    data: T;
}
export interface PurchaseDetail {
    MaChiTietPhieuNhap: number;
    MaSanPham: number | string;
    TenSanPham: string;
    SoLuong: number;
    DonGia: number | string;
    TongGia: number | string;
}

export interface PurchaseOrder {
    MaPhieuNhap: number;
    NgayLap: string;
    TrangThai: number;
    TongGiaTri: number | string;
    MaTaiKhoan: number | null;
    MaNhaCungCap: number;
    nha_cung_cap?: { MaNhaCungCap: number; TenNhaCungCap: string } | null;
    chi_tiet_phieu_nhap?: PurchaseDetail[];
}

export interface Page<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}
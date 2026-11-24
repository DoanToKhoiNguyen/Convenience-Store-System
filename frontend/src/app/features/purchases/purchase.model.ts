export interface PurchaseUser {
    MaTaiKhoan: number;
    HoTen: string;
}

export interface PurchaseDetail {
    MaChiTietPhieuNhap: number;
    MaSanPham: number | string;
    TenSanPham: string;
    SoLuong: number;
    DonGia: number | string;
    TongGia: number | string;
    lo_hang?: { MaLo: string; HanSuDung: string | null } | null;
    san_pham?: { MaSanPham: number; TenSanPham: string; HinhAnh: string | null; hinh_anh_url: string | null } | null;
}

export interface PurchaseOrder {
    MaPhieuNhap: string;
    NgayLap: string;
    TrangThai: number;
    TongGiaTri: number | string;
    MaTaiKhoan: number | null;
    MaNhaCungCap: number;
    MaTaiKhoanDuyet?: number | null;
    NgayDuyet?: string | null;
    MaTaiKhoanNhan?: number | null;
    NgayNhan?: string | null;
    nha_cung_cap?: { MaNhaCungCap: number; TenNhaCungCap: string } | null;
    taikhoan?: PurchaseUser | null;
    nguoi_duyet?: PurchaseUser | null;
    nguoi_nhan?: PurchaseUser | null;
    chi_tiet_phieu_nhap?: PurchaseDetail[];
}

export interface PurchaseCounts {
    tong: number;
    cho_duyet: number;
    cho_nhan: number;
    da_huy: number;
    da_nhan: number;
}

export interface Page<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    counts?: PurchaseCounts;
}

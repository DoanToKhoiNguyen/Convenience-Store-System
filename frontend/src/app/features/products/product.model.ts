export interface Product {
    MaSanPham: number | string;
    TenSanPham: string;
    DonGiaBan: number | string;
    DonGiaNhap?: number | string | null;
    SoLuongHienTai: number;
    TonKhoToiThieu: number;
    TonKhoToiDa?: number | null;
    CanhBaoHSD?: number | null;
    TenThuongHieu?: string | null;
    LoaiSanPham?: string | null;
    MaNhaCungCap?: number | null;
    MoTa?: string | null;
    ThanhPhan?: string | null;
    TrangThai?: boolean | number;
    HinhAnh?: string | null;
    hinh_anh_url?: string | null;
    MaDanhMuc?: number | null;
}

export interface ProductPayload {
    TenSanPham: string;
    MaDanhMuc: number;
    TenThuongHieu: string | null;
    MaNhaCungCap: number;
    DonGiaBan: number;
    DonGiaNhap: number;
    TonKhoToiThieu: number;
    TonKhoToiDa: number | null;
    CanhBaoHSD: number | null;
    MoTa: string | null;
    ThanhPhan: string | null;
    SoLuongHienTai?: number; // chỉ dùng khi thêm mới
}

export interface Supplier {
    MaNhaCungCap: number;
    TenNhaCungCap: string;
    TrangThai?: boolean | number;
}
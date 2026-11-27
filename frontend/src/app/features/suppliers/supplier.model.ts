export interface SupplierCategory {
    MaDanhMuc: number;
    TenDanhMuc: string;
}

export interface SupplierItem {
    MaNhaCungCap: number;
    TenNhaCungCap: string;
    DiaChi: string;
    SoDienThoai: string;
    TrangThai?: boolean | number;
    danh_muc?: SupplierCategory[];
}

export interface SupplierPayload {
    TenNhaCungCap: string;
    DiaChi: string;
    SoDienThoai: string;
    DanhMuc: number[];
}

/** Một sản phẩm gắn với nhà cung cấp: đang phụ trách và/hoặc từng có trong phiếu nhập. */
export interface SupplierProduct {
    MaSanPham: number;
    TenSanPham: string;
    hinh_anh_url: string | null;
    dang_ban: boolean;
    dang_cung_cap: boolean;
    so_phieu: number;
    tong_so_luong: number;
}
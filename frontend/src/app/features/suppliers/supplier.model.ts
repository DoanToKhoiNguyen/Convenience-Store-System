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
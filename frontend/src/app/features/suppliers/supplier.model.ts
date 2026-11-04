export interface SupplierItem {
    MaNhaCungCap: number;
    TenNhaCungCap: string;
    DiaChi: string;
    SoDienThoai: string;
    TrangThai?: boolean | number;
}

export interface SupplierPayload {
    TenNhaCungCap: string;
    DiaChi: string;
    SoDienThoai: string;
}
export interface Category {
    MaDanhMuc: number;
    TenDanhMuc: string;
    MoTa: string | null;
    san_pham_count?: number;
}

export interface CategoryPayload {
    TenDanhMuc: string;
    MoTa: string | null;
}
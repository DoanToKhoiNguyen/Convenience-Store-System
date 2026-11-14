export interface Category {
    MaDanhMuc: number;
    TenDanhMuc: string;
    san_pham_count?: number;
}

export interface CategoryPayload {
    TenDanhMuc: string;
}
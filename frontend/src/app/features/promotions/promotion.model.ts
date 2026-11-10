export type PromoType = 'phan_tram' | 'so_tien';
export type PromoStatus = 'dang_chay' | 'sap_chay' | 'het_han' | 'tam_ngung';

export interface Promotion {
    MaKhuyenMai: number;
    TenChuongTrinh: string;
    LoaiGiam: PromoType;
    GiaTriGiam: number | string;
    DieuKienApDung: number | string;
    GiamToiDa?: number | string | null;
    NgayBatDau: string;
    NgayKetThuc: string;
    TrangThai: boolean | number;
    trang_thai_text: PromoStatus;
    hoa_don_count?: number;
}

export interface PromotionPayload {
    TenChuongTrinh: string;
    LoaiGiam: PromoType;
    GiaTriGiam: number;
    DieuKienApDung: number;
    GiamToiDa: number | null;
    NgayBatDau: string; // YYYY-MM-DD
    NgayKetThuc: string;
    TrangThai: boolean;
}

export interface Estimate {
    tong_tien_hang: number;
    giam: number;
    phai_tra: number;
    chuong_trinh: string | null;
}
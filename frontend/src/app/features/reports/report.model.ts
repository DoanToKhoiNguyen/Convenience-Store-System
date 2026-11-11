export type Group = 'gio' | 'ngay' | 'thang';

export interface Summary {
    so_hoa_don: number;
    doanh_thu: number;
    giam_gia: number;
    trung_binh: number;
    gia_von?: number;
    loi_nhuan?: number;
    bien_loi_nhuan?: number;
}

export interface SeriesPoint {
    k: string;
    nhan: string;
    doanh_thu: number;
    so_hoa_don: number;
    loi_nhuan?: number;
}

export interface ProductStat {
    MaSanPham: number;
    TenSanPham: string;
    LoaiSanPham: string | null;
    so_luong: number;
    doanh_thu: number;
    loi_nhuan?: number;
}

export interface SlowProduct {
    MaSanPham: number;
    TenSanPham: string;
    LoaiSanPham: string | null;
    SoLuongHienTai: number;
    so_luong: number;
    doanh_thu: number;
    von_ton?: number;
}

export interface MethodStat {
    ten: string;
    so_hoa_don: number;
    doanh_thu: number;
}

export interface StaffStat {
    MaTaiKhoan: number;
    HoTen: string;
    so_hoa_don: number;
    doanh_thu: number;
}

export interface RevenueReport {
    ky: { tu_ngay: string; den_ngay: string; nhom: Group };
    ky_truoc: { tu_ngay: string; den_ngay: string };
    quyen: { xem_loi_nhuan: boolean };
    tong_hop: Summary;
    tong_hop_truoc: Summary;
    chuoi: SeriesPoint[];
    phuong_thuc: MethodStat[];
    nhan_vien: StaffStat[];
    ban_chay: ProductStat[];
    sinh_loi?: ProductStat[];
    ban_cham: SlowProduct[];
    dang_cho: { so_hoa_don: number; tong_tien: number };
}
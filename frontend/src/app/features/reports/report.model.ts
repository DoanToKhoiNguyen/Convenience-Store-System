export type Group = 'gio' | 'ngay' | 'thang';

export interface Summary {
    so_hoa_don: number;
    doanh_thu: number;
    giam_gia: number;
    trung_binh: number;
    gia_von?: number;
    loi_nhuan?: number;
    bien_loi_nhuan?: number;
    gia_tri_huy?: number;
    lai_sau_huy?: number;
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

/** Một lô hết hạn bị loại trong kỳ: bán được bao nhiêu, vốn bao nhiêu, lỗ bao nhiêu. */
export interface LossLot {
    MaLoHang: number;
    MaLo: string;
    MaSanPham: number;
    TenSanPham: string;
    HanSuDung: string | null;
    ThoiGianLoai: string;
    SoLuongNhap: number;
    so_luong_ban: number;
    so_luong_loai: number;
    don_gia: number;
    gia_tri_nhap: number;
    doanh_thu: number;
    lo_huy: number;
    lai: number;
}

export interface LossProduct {
    MaSanPham: number;
    TenSanPham: string;
    so_luong: number;
    gia_tri: number;
}

export interface LossTotals {
    so_lo: number;
    so_luong_nhap: number;
    so_luong_ban: number;
    so_luong_loai: number;
    gia_tri_nhap: number;
    doanh_thu: number;
    lo_huy: number;
    lai: number;
}

export interface LossPoint {
    k: string;
    nhan: string;
    gia_tri: number;
}

export interface ExpiredLoss {
    tong: LossTotals;
    theo_lo: LossLot[];
    san_pham: LossProduct[];
    chuoi: LossPoint[];
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
    nhan_vien: StaffStat[];
    ban_chay: ProductStat[];
    sinh_loi?: ProductStat[];
    ban_cham: SlowProduct[];
    het_han?: ExpiredLoss;
    dang_cho: { so_hoa_don: number; tong_tien: number };
}
export interface ImportSummary {
    so_phieu: number;
    so_luong: number;
    gia_tri: number;
    so_san_pham: number;
    trung_binh: number;
}

export interface ImportPoint {
    k: string;
    nhan: string;
    gia_tri: number;
    so_phieu: number;
}

export interface ImportSupplier {
    MaNhaCungCap: number;
    TenNhaCungCap: string;
    so_phieu: number;
    gia_tri: number;
}

export interface ImportProduct {
    MaSanPham: number;
    TenSanPham: string;
    so_luong: number;
    gia_tri: number;
    gia_trung_binh: number;
    gia_thap: number;
    gia_cao: number;
}

export interface ImportReceipt {
    MaPhieuNhap: string;
    TenNhaCungCap: string | null;
    ngay_nhan: string;
    so_dong: number;
    so_luong: number;
    gia_tri: number;
}

export interface ImportReport {
    ky: { tu_ngay: string; den_ngay: string; nhom: Group };
    ky_truoc: { tu_ngay: string; den_ngay: string };
    tong_hop: ImportSummary;
    tong_hop_truoc: ImportSummary;
    chuoi: ImportPoint[];
    nha_cung_cap: ImportSupplier[];
    san_pham: ImportProduct[];
    phieu_nhap: ImportReceipt[];
    dang_cho: { so_phieu: number; gia_tri: number };
}
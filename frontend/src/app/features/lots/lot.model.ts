export type LotStatus = 'het_han' | 'sap_het_han' | 'binh_thuong' | 'khong_han';

export interface Lot {
    MaLoHang: number;
    MaLo: string;
    MaSanPham: number;
    NgayNhap: string | null;
    HanSuDung: string | null;
    SoLuongNhap: number;
    SoLuongCon: number;
    so_ngay_con_lai: number | null;
    trang_thai: LotStatus;
}

export interface LotAlert extends Lot {
    TenSanPham: string;
    LoaiSanPham: string | null;
    CanhBaoHSD: number;
}

export function lotText(l: Pick<Lot, 'trang_thai' | 'so_ngay_con_lai'>): string {
    const n = l.so_ngay_con_lai ?? 0;
    switch (l.trang_thai) {
        case 'het_han':
            return `Quá hạn ${Math.abs(n)} ngày`;
        case 'sap_het_han':
            return n === 0 ? 'Hết hạn hôm nay' : `Còn ${n} ngày`;
        case 'binh_thuong':
            return `Còn ${n} ngày`;
        default:
            return 'Không có hạn';
    }
}

export function lotSeverity(s: LotStatus): 'danger' | 'warn' | 'success' | 'secondary' {
    return s === 'het_han' ? 'danger' : s === 'sap_het_han' ? 'warn' : s === 'binh_thuong' ? 'success' : 'secondary';
}
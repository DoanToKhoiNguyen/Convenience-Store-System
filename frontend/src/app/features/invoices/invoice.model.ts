export type InvoiceStatus = 'da_thanh_toan' | 'cho_thanh_toan' | 'da_huy' | 'nhap';

export interface InvoiceLine {
    MaChiTietHoaDon: number;
    TenSanPham: string;
    SoLuong: number;
    ThanhTien: number | string;
}

export interface InvoiceItem {
    MaHoaDon: number;
    NgayLap: string;
    TongTien: number | string;
    TienGiamGia?: number | string | null;
    MaGiaoDich?: string | null;
    TenGiaoDich?: string | null;
    HanThanhToan?: string | null;
    NgayThanhToan?: string | null;
    LyDoHuy?: string | null;
    trang_thai_text: InvoiceStatus;
    chi_tiet_hoa_don?: InvoiceLine[];
    tai_khoan?: { HoTen: string } | null;
    TongTienHang?: number | string;
    khuyen_mai?: { TenChuongTrinh: string } | null;
}

export interface InvoicePage {
    data: InvoiceItem[];
    current_page: number;
    last_page: number;
    total: number;
}
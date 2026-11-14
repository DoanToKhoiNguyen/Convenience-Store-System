import { Lot, LotStatus } from '../lots/lot.model';

export interface Product {
    MaSanPham: number | string;
    TenSanPham: string;
    DonGiaBan: number | string;
    DonGiaNhap?: number | string | null;
    SoLuongHienTai: number;
    TonKhoToiThieu: number;
    TonKhoToiDa?: number | null;
    CanhBaoHSD?: number | null;
    TenThuongHieu?: string | null;
    LoaiSanPham?: string | null;
    MaNhaCungCap?: number | null;
    MoTa?: string | null;
    ThanhPhan?: string | null;
    TrangThai?: boolean | number;
    HinhAnh?: string | null;
    hinh_anh_url?: string | null;
    MaDanhMuc?: number | null;
    TienToLo?: string | null;
    lo_hang?: Lot[];
    han_gan_nhat?: string | null;
    so_ngay_hsd?: number | null;
    trang_thai_hsd?: LotStatus;
    SoLuongBanDuoc?: number;
    so_luong_het_han?: number;
}

export interface ProductPayload {
    TenSanPham: string;
    MaDanhMuc: number;
    TenThuongHieu: string | null;
    MaNhaCungCap: number;
    DonGiaBan: number;
    DonGiaNhap: number;
    TonKhoToiThieu: number;
    TonKhoToiDa: number | null;
    CanhBaoHSD: number | null;
    MoTa: string | null;
    ThanhPhan: string | null;
    SoLuongHienTai?: number;
    TienToLo: string | null;
    HanSuDungBanDau?: string | null;
}

export interface Supplier {
    MaNhaCungCap: number;
    TenNhaCungCap: string;
    TrangThai?: boolean | number;
}
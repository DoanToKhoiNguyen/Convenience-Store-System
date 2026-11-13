export interface PublicProduct {
    MaSanPham: number;
    TenSanPham: string;
    DonGiaBan: number | string;
    TenThuongHieu: string | null;
    LoaiSanPham: string | null;
    MoTa: string | null;
    ThanhPhan: string | null;
    hinh_anh_url: string | null;
    con_hang: boolean;
}
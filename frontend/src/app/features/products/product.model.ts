export interface Product {
    MaSanPham: number | string;
    TenSanPham: string;
    DonGiaBan: number | string; // Laravel thường trả decimal dạng chuỗi
    SoLuongHienTai: number;
    TonKhoToiThieu: number;
    TonKhoToiDa?: number | null;
    TenThuongHieu?: string | null;
    LoaiSanPham?: string | null;
    MoTa?: string | null;
}
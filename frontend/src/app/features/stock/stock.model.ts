import { Product } from '../products/product.model';

export interface AlertProduct extends Product {
    MaNhaCungCap?: number | null;
    DonGiaNhap?: number | string | null;
    // Chỉ có nếu bạn làm phần "nên làm" ở cuối (số lượng đang nằm trong phiếu chưa nhận)
    SoLuongDangNhap?: number;
    // Laravel đổi nhaCungCap thành nha_cung_cap khi trả JSON
    nha_cung_cap?: { MaNhaCungCap: number; TenNhaCungCap: string } | null;
}
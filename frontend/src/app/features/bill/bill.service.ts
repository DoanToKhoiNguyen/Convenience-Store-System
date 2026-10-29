import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, HoaDon, ChiTietHoaDon, SanPham } from './bill.model';

@Injectable({
    providedIn: 'root',
})
export class BillService {
    private http = inject(HttpClient);
    private apiUrl = '/api/hoa-don'; // Khớp với route backend của HoaDonController
    private apiSanPhamUrl = '/api/san-pham';

    // Tạo hóa đơn nháp mới
    taoHoaDon(): Observable<ApiResponse<HoaDon>> {
        return this.http.post<ApiResponse<HoaDon>>(`${this.apiUrl}`, {});
    }

    // Thêm sản phẩm vào hóa đơn
    themChiTiet(maHD: number, data: { TenSanPham: string; SoLuong: number }): Observable<ApiResponse<{ hoaDon: HoaDon; chiTiet: ChiTietHoaDon }>> {
        return this.http.post<ApiResponse<{ hoaDon: HoaDon; chiTiet: ChiTietHoaDon }>>(`${this.apiUrl}/${maHD}/chi-tiet`, data);
    }
    // Trong bill.service.ts
    timKiemSanPham(query: string): Observable<ApiResponse<SanPham[]>> {
        const params = new HttpParams().set('q', query); // Truyền từ khóa qua query parameter ?q=...
        return this.http.get<ApiResponse<SanPham[]>>(`${this.apiSanPhamUrl}/tra-cuu`, { params });
    }
    // Thanh toán hóa đơn
    thanhToanHoaDon(maHD: number, data?: { maGiaoDich?: string; tenGiaoDich?: string; tienGiamGia?: number }): Observable<ApiResponse<HoaDon>> {
        return this.http.post<ApiResponse<HoaDon>>(`${this.apiUrl}/${maHD}/thanh-toan`, data || {});
    }

    layDanhSachHoaDon(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/hoa-don`);
    }
}
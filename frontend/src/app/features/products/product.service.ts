import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
    private http = inject(HttpClient);
    private apiUrl = '/api';
    getAll() {
        return this.http
            .get<{ data: Product[] }>(`${environment.apiUrl}/san-pham`)
            .pipe(map((res) => res.data));
    }

    layDanhSachSanPham(keyword?: string): Observable<any> {
        const url = keyword ? `${this.apiUrl}/san-pham/tra-cuu?q=${keyword}` : `${this.apiUrl}/san-pham`;
        return this.http.get<any>(url);
    }

    capNhatTonKho(maSanPham: string | number, data: { SoLuongMoi: number; LyDoCapNhat: string }): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/san-pham/${maSanPham}/ton-kho`, data);
    }

    layLichSuTonKho(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/san-pham/lich-su-ton-kho`);
    }
}
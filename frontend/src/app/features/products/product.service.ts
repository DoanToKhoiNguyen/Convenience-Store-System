import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductPayload, Supplier } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/san-pham`;

    getAll() {
        return this.http.get<{ data: Product[] }>(this.url).pipe(map((res) => res.data));
    }

    create(body: ProductPayload) {
        return this.http.post<{ data: Product }>(this.url, body);
    }

    update(id: number | string, body: ProductPayload) {
        return this.http.put<{ data: Product }>(`${this.url}/${id}`, body);
    }

    layLichSuTonKho() {
        return this.http.get<any>(`${environment.apiUrl}/lich-su-ton-kho`).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as any[];
            }),
        );
    }

    suppliers() {
        return this.http.get<any>(`${environment.apiUrl}/nha-cung-cap`).pipe(
            map((res) => {
                const d = res?.data ?? res;
                const list = Array.isArray(d) ? d : Object.values(d ?? {});
                return list.map((s: any) => ({
                    MaNhaCungCap: s.MaNhaCungCap,
                    TenNhaCungCap: s.TenNhaCungCap ?? `Nhà cung cấp #${s.MaNhaCungCap}`,
                    TrangThai: s.TrangThai ?? 1,
                })) as Supplier[];
            }),
        );
    }

    remove(id: number | string) {
        return this.http.delete<{ message: string; action: 'deleted' | 'hidden' }>(`${this.url}/${id}`);
    }

    restore(id: number | string) {
        return this.http.post<{ message: string }>(`${this.url}/${id}/hien-thi`, {});
    }

    updateStock(id: number | string, soLuongMoi: number, lyDo: string) {
        return this.http.put<{ message: string }>(`${this.url}/${id}/ton-kho`, {
            SoLuongMoi: soLuongMoi,
            LyDoCapNhat: lyDo,
        });
    }
}
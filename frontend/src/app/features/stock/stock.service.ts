import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertProduct } from './stock.model';

@Injectable({ providedIn: 'root' })
export class StockService {
    private http = inject(HttpClient);

    alerts() {
        return this.http
            .get<{ data: AlertProduct[] | Record<string, AlertProduct> }>(
                `${environment.apiUrl}/san-pham/canh-bao`,
            )
            .pipe(
                map((res) => {
                    const d = res.data;
                    if (Array.isArray(d)) return d;
                    return d ? Object.values(d) : [];
                }),
            );
    }

    createPurchase(supplierId: number, items: { id: number | string; qty: number }[]) {
        return this.http.post<{ data: { MaPhieuNhap: number } }>(`${environment.apiUrl}/phieu-nhap`, {
            MaNhaCungCap: supplierId,
            ChiTiet: items.map((i) => ({ MaSanPham: i.id, SoLuong: i.qty })),
        });
    }
}
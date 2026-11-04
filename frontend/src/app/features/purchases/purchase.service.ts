import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, PurchaseOrder } from './purchase.model';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/phieu-nhap`;

    list(page: number) {
        return this.http.get<any>(this.url, { params: { page } }).pipe(
            map((res): Page<PurchaseOrder> => {
                const d = res?.data ?? res;
                if (Array.isArray(d)) {
                    return { data: d, current_page: 1, last_page: 1, per_page: d.length, total: d.length };
                }
                return {
                    data: d?.data ?? [],
                    current_page: d?.current_page ?? 1,
                    last_page: d?.last_page ?? 1,
                    per_page: d?.per_page ?? 10,
                    total: d?.total ?? 0,
                };
            }),
        );
    }

    approve(id: number) {
        return this.http.post(`${this.url}/${id}/duyet`, {});
    }

    cancel(id: number) {
        return this.http.post(`${this.url}/${id}/huy`, {});
    }

    receive(id: number, items: { MaChiTietPhieuNhap: number; NgaySanXuat: string }[]) {
        return this.http.put(`${this.url}/${id}/nhan-hang`, { ChiTiet: items });
    }
}
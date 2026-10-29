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
        return this.http
            .get<{ data: Page<PurchaseOrder> }>(this.url, { params: { page } })
            .pipe(map((res) => res.data));
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
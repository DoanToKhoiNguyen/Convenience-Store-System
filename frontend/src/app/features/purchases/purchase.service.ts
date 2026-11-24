import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, PurchaseOrder } from './purchase.model';
import { NoticeService } from '../../core/ui/notice.service';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
    private http = inject(HttpClient);
    private notice = inject(NoticeService);
    private url = `${environment.apiUrl}/phieu-nhap`;

    list(page: number, trangThai: number | null = null) {
        const params: Record<string, number> = { page };
        if (trangThai !== null) params['TrangThai'] = trangThai;

        return this.http.get<any>(this.url, { params }).pipe(
            map((res): Page<PurchaseOrder> => {
                const d = res?.data ?? res;
                if (Array.isArray(d)) {
                    return {
                        data: d,
                        current_page: 1,
                        last_page: 1,
                        per_page: d.length,
                        total: d.length,
                        counts: res?.counts,
                    };
                }
                return {
                    data: d?.data ?? [],
                    current_page: d?.current_page ?? 1,
                    last_page: d?.last_page ?? 1,
                    per_page: d?.per_page ?? 10,
                    total: d?.total ?? 0,
                    counts: res?.counts,
                };
            }),
        );
    }

    approve(id: string) {
        return this.http.post(`${this.url}/${id}/duyet`, {}).pipe(tap(() => this.notice.refresh()));
    }

    cancel(id: string) {
        return this.http.post(`${this.url}/${id}/huy`, {}).pipe(tap(() => this.notice.refresh()));
    }

    receive(id: string, items: { MaChiTietPhieuNhap: number; HanSuDung: string | null }[]) {
        return this.http
            .put(`${this.url}/${id}/nhan-hang`, { ChiTiet: items })
            .pipe(tap(() => this.notice.refresh()));
    }
}

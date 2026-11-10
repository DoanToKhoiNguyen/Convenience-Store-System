import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InvoicePage } from './invoice.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/hoa-don`;

    list(status: string, page: number) {
        return this.http.get<any>(this.url, { params: { trang_thai: status, page } }).pipe(
            map((res): InvoicePage => {
                const d = res?.data ?? res;
                return {
                    data: d?.data ?? [],
                    current_page: d?.current_page ?? 1,
                    last_page: d?.last_page ?? 1,
                    total: d?.total ?? 0,
                };
            }),
        );
    }

    cancel(id: number, reason: string) {
        return this.http.post(`${this.url}/${id}/huy`, { LyDo: reason });
    }
}
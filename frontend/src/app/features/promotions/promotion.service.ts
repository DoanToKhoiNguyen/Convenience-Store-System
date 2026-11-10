import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Estimate, Promotion, PromotionPayload } from './promotion.model';

@Injectable({ providedIn: 'root' })
export class PromotionService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/khuyen-mai`;

    list() {
        return this.http.get<any>(this.url).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as Promotion[];
            }),
        );
    }

    create(body: PromotionPayload) {
        return this.http.post<{ message: string }>(this.url, body);
    }

    update(id: number, body: PromotionPayload) {
        return this.http.put<{ message: string }>(`${this.url}/${id}`, body);
    }

    remove(id: number) {
        return this.http.delete<{ message: string; action: 'deleted' | 'hidden' }>(`${this.url}/${id}`);
    }

    restore(id: number) {
        return this.http.post<{ message: string }>(`${this.url}/${id}/bat-lai`, {});
    }

    estimate(total: number) {
        return this.http.get<Estimate>(`${this.url}/uoc-tinh`, { params: { tong_tien: total } });
    }
}
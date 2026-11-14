import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotAlert } from './lot.model';

@Injectable({ providedIn: 'root' })
export class LotService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/lo-hang`;

    alerts() {
        return this.http.get<any>(`${this.url}/canh-bao`).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as LotAlert[];
            }),
        );
    }

    cancel(id: number, reason: string) {
        return this.http.post<{ message: string }>(`${this.url}/${id}/huy`, { LyDo: reason });
    }

    setExpiry(id: number, date: string | null) {
        return this.http.put<{ message: string }>(`${this.url}/${id}/han-su-dung`, { HanSuDung: date });
    }
}
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RemovedLot, LotAlert } from './lot.model';
import { NoticeService } from '../../core/ui/notice.service';

@Injectable({ providedIn: 'root' })
export class LotService {
    private http = inject(HttpClient);
    private notice = inject(NoticeService);
    private url = `${environment.apiUrl}/lo-hang`;

    alerts() {
        return this.http.get<any>(`${this.url}/canh-bao`).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as LotAlert[];
            }),
        );
    }

    removed() {
        return this.http.get<{ data: RemovedLot[] }>(`${this.url}/da-loai`).pipe(
            map((res) => res?.data ?? []),
        );
    }

    setExpiry(id: number, date: string | null) {
        return this.http
            .put<{ message: string }>(`${this.url}/${id}/han-su-dung`, { HanSuDung: date })
            .pipe(tap(() => this.notice.refresh()));
    }
}
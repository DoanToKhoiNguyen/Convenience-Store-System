import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Staff, StaffPayload } from './staff.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/nhan-vien`;

    list() {
        return this.http.get<any>(this.url).pipe(
            map((r) => {
                const d = r?.data ?? r;
                if (Array.isArray(d)) return d as Staff[];       // { data: [...] }
                if (Array.isArray(d?.data)) return d.data as Staff[]; // { data: { data: [...] } } (phân trang)
                return d ? (Object.values(d) as Staff[]) : [];
            }),
        );
    }

    create(body: StaffPayload) {
        return this.http.post(this.url, body);
    }

    update(id: number, body: StaffPayload) {
        return this.http.put(`${this.url}/${id}`, body);
    }
}
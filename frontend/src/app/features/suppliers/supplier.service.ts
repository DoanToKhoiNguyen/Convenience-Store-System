import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupplierItem, SupplierPayload } from './supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/nha-cung-cap`;

    list() {
        return this.http.get<any>(this.url).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as SupplierItem[];
            }),
        );
    }

    create(body: SupplierPayload) {
        return this.http.post(this.url, body);
    }

    update(id: number, body: SupplierPayload) {
        return this.http.put(`${this.url}/${id}`, body);
    }

    remove(id: number) {
        return this.http.delete<{ message: string; action: 'deleted' | 'hidden' }>(`${this.url}/${id}`);
    }

    restore(id: number) {
        return this.http.post<{ message: string }>(`${this.url}/${id}/hien-thi`, {});
    }
}
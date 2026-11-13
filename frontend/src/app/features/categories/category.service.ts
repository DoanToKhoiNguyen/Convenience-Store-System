import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CategoryPayload } from './category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/danh-muc`;

    list() {
        return this.http.get<any>(this.url).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as Category[];
            }),
        );
    }

    create(body: CategoryPayload) {
        return this.http.post<{ message: string }>(this.url, body);
    }

    update(id: number, body: CategoryPayload) {
        return this.http.put<{ message: string }>(`${this.url}/${id}`, body);
    }

    remove(id: number) {
        return this.http.delete<{ message: string }>(`${this.url}/${id}`);
    }
}
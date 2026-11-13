import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicProduct } from './public.model';

@Injectable({ providedIn: 'root' })
export class PublicService {
    private http = inject(HttpClient);

    products() {
        return this.http.get<any>(`${environment.apiUrl}/cong-khai/san-pham`).pipe(
            map((res) => {
                const d = res?.data ?? res;
                return (Array.isArray(d) ? d : Object.values(d ?? {})) as PublicProduct[];
            }),
        );
    }
}
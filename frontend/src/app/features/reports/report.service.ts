import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Group, RevenueReport } from './report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
    private http = inject(HttpClient);

    revenue(from: string, to: string, group: Group) {
        return this.http.get<RevenueReport>(`${environment.apiUrl}/bao-cao/doanh-thu`, {
            params: { tu_ngay: from, den_ngay: to, nhom: group },
        });
    }
}
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RegisterData, Slot, TimetableData } from './shift.model';

@Injectable({ providedIn: 'root' })
export class ShiftService {
    private http = inject(HttpClient);

    registration() {
        return this.http.get<any>(`${environment.apiUrl}/dang-ky-ca/tuan-sau`).pipe(
            map((r): RegisterData => ({
                tuan: r?.tuan,
                ca: Array.isArray(r?.ca) ? r.ca : [],
                da_chon: Array.isArray(r?.da_chon) ? r.da_chon : [],
            })),
        );
    }

    saveRegistration(slots: Slot[]) {
        return this.http.put<{ message: string }>(`${environment.apiUrl}/dang-ky-ca/tuan-sau`, {
            ChiTiet: slots,
        });
    }

    timetable(from?: string) {
        return this.http
            .get<any>(`${environment.apiUrl}/lich-lam-viec`, { params: from ? { tu_ngay: from } : {} })
            .pipe(
                map((r): TimetableData => ({
                    tuan: r?.tuan,
                    ca: Array.isArray(r?.ca) ? r.ca : [],
                    data: Array.isArray(r?.data) ? r.data : [],
                })),
            );
    }
}
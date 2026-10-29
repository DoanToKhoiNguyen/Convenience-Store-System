import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, concat, map, of, switchMap, throwError, toArray } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Invoice {
    MaHoaDon: number;
    TongTien: number | string;
    TenGiaoDich?: string | null;
}

export interface CheckoutLine {
    name: string;
    qty: number;
}

export interface Draft {
    id: number;
    total: number;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/hoa-don`;

    // Tạo hóa đơn nháp + thêm từng dòng. Tổng tiền lấy từ server.
    createDraft(lines: CheckoutLine[]) {
        return this.http.post<{ data: Invoice }>(this.url, {}).pipe(
            switchMap((created) => {
                const id = created.data.MaHoaDon;
                return concat(
                    ...lines.map((l) =>
                        this.http.post<{ data: { hoaDon: Invoice } }>(`${this.url}/${id}/chi-tiet`, {
                            TenSanPham: l.name,
                            SoLuong: l.qty,
                        }),
                    ),
                ).pipe(
                    toArray(),
                    map((responses): Draft => ({
                        id,
                        total: Number(responses[responses.length - 1].data.hoaDon.TongTien),
                    })),
                    // Lỗi giữa chừng thì dọn hóa đơn nháp rồi báo lỗi tiếp
                    catchError((err) => this.cancelDraft(id).pipe(switchMap(() => throwError(() => err)))),
                );
            }),
        );
    }

    pay(id: number, method: string, txCode: string | null = null) {
        return this.http
            .put<{ data: Invoice }>(`${this.url}/${id}/thanh-toan`, {
                tenGiaoDich: method,
                maGiaoDich: txCode,
                tienGiamGia: 0,
            })
            .pipe(map((res) => res.data));
    }

    // Dùng cho tiền mặt: tạo nháp rồi thanh toán luôn
    checkout(lines: CheckoutLine[], method: string) {
        return this.createDraft(lines).pipe(
            switchMap((draft) =>
                this.pay(draft.id, method).pipe(
                    catchError((err) => this.cancelDraft(draft.id).pipe(switchMap(() => throwError(() => err)))),
                ),
            ),
        );
    }

    cancelDraft(id: number) {
        return this.http.delete(`${this.url}/${id}`).pipe(catchError(() => of(null)));
    }
}
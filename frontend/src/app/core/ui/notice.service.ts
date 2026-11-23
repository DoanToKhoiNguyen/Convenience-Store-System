import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

interface NoticeCounts {
  canh_bao_kho: number;
  canh_bao_kho_tong: number;
  phieu_cho_duyet: number;
  phieu_cho_nhan: number;
}

@Injectable({ providedIn: 'root' })
export class NoticeService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly canhBaoKho = signal(0);
  readonly canhBaoKhoTong = signal(0);
  readonly phieuChoDuyet = signal(0);
  readonly phieuChoNhan = signal(0);

  // Thông báo nổi khi có việc mới xuất hiện (không báo khi chính mình vừa xử lý xong)
  readonly thongBaoMoi = signal<string | null>(null);

  private daTai = false;
  private anTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.refresh();
    setInterval(() => this.refresh(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh();
    });
  }

  refresh() {
    // Đăng xuất rồi thì thôi, không gọi API bằng token đã mất
    if (document.hidden || !this.auth.user()) {
      if (!this.auth.user()) this.daTai = false;
      return;
    }

    this.http.get<NoticeCounts>(`${environment.apiUrl}/thong-bao`).subscribe({
      next: (c) => this.apDung(c),
      // Mất mạng thì giữ số cũ, lần sau thử lại.
      error: () => {},
    });
  }

  private apDung(c: NoticeCounts) {
    const kho = Number(c?.canh_bao_kho ?? 0);
    const tong = Number(c?.canh_bao_kho_tong ?? kho);
    const duyet = Number(c?.phieu_cho_duyet ?? 0);
    const nhan = Number(c?.phieu_cho_nhan ?? 0);

    if (this.daTai) {
      const moi: string[] = [];
      if (kho > this.canhBaoKho()) moi.push(`${kho - this.canhBaoKho()} sản phẩm sắp hết hàng chưa có phiếu nhập`);
      if (duyet > this.phieuChoDuyet()) moi.push(`${duyet - this.phieuChoDuyet()} phiếu nhập mới chờ duyệt`);
      if (nhan > this.phieuChoNhan()) moi.push(`${nhan - this.phieuChoNhan()} phiếu nhập chờ nhận hàng`);
      if (moi.length) this.hienThongBao('Có ' + moi.join('; ') + '.');
    }

    this.canhBaoKho.set(kho);
    this.canhBaoKhoTong.set(tong);
    this.phieuChoDuyet.set(duyet);
    this.phieuChoNhan.set(nhan);
    this.daTai = true;
  }

  private hienThongBao(text: string) {
    this.thongBaoMoi.set(text);
    clearTimeout(this.anTimer);
    this.anTimer = setTimeout(() => this.thongBaoMoi.set(null), 8000);
  }

  anThongBao() {
    clearTimeout(this.anTimer);
    this.thongBaoMoi.set(null);
  }
}

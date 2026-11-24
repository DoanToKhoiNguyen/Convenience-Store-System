import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

interface NoticeCounts {
  canh_bao_kho: number;
  canh_bao_kho_tong: number;
  lo_sap_het_han: number;
  lo_da_loai: number;
  phieu_cho_duyet: number;
  phieu_cho_nhan: number;
}

// Số liệu đã xem của từng kênh: badge còn hiện chuông khi số liệu hiện tại lớn hơn mốc này
type Kenh = 'kho' | 'mua' | 'han' | 'daLoai';
type DaXem = Record<Kenh, number>;

const DA_XEM_KEY = 'thong-bao-da-xem';
const MOC_GOC: DaXem = { kho: 0, mua: 0, han: 0, daLoai: 0 };

// Mốc "đã xem" lưu riêng từng tài khoản để đổi tài khoản trên cùng máy không dùng lại mốc của người trước
function docDaXem(maTaiKhoan: number): DaXem {
  try {
    const raw = localStorage.getItem(`${DA_XEM_KEY}.${maTaiKhoan}`);
    if (raw) return { ...MOC_GOC, ...JSON.parse(raw) };
  } catch {
    // trình duyệt chặn localStorage thì coi như chưa xem gì
  }
  return { ...MOC_GOC };
}

@Injectable({ providedIn: 'root' })
export class NoticeService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly canhBaoKho = signal(0);
  readonly canhBaoKhoTong = signal(0);
  readonly loSapHetHan = signal(0);
  readonly loDaLoai = signal(0);
  readonly phieuChoDuyet = signal(0);
  readonly phieuChoNhan = signal(0);

  // Thông báo nổi khi có việc mới xuất hiện (không báo khi chính mình vừa xử lý xong)
  readonly thongBaoMoi = signal<string | null>(null);

  private readonly daXem = signal<DaXem>({ ...MOC_GOC });
  private choXem = new Set<Kenh>();

  // Chuông chỉ hiện cho việc mới; xem xong thì badge giữ nguyên con số
  readonly moiKho = computed(() => this.canhBaoKho() > this.daXem().kho);
  readonly moiMua = computed(() => this.phieuChoDuyet() + this.phieuChoNhan() > this.daXem().mua);
  readonly moiHan = computed(() => this.loSapHetHan() > this.daXem().han);
  readonly moiDaLoai = computed(() => this.loDaLoai() > this.daXem().daLoai);

  private daTai = false;
  private anTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Đăng nhập / đổi tài khoản thì nạp mốc đã xem của đúng tài khoản đó
    effect(() => {
      const id = this.auth.user()?.MaTaiKhoan ?? null;
      this.daXem.set(id === null ? { ...MOC_GOC } : docDaXem(Number(id)));
    });

    this.refresh();
    setInterval(() => this.refresh(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh();
    });
  }

  /**
   * Đánh dấu người dùng đã mở trang chứa kênh này.
   * Chốt ngay bằng số liệu đang có để chuông tắt tức thì, và giữ một lần nâng mốc
   * theo số liệu mới nhất ở lần tải kế tiếp. Mốc chỉ tăng, không bao giờ giảm.
   */
  xemKenh(k: Kenh) {
    const moc = { ...this.daXem() };
    moc[k] = Math.max(moc[k], this.soHienTai(k));
    this.luuDaXem(moc);
    this.choXem.add(k);
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
    const sapHetHan = Number(c?.lo_sap_het_han ?? 0);
    const daLoai = Number(c?.lo_da_loai ?? 0);
    const duyet = Number(c?.phieu_cho_duyet ?? 0);
    const nhan = Number(c?.phieu_cho_nhan ?? 0);

    if (this.daTai) {
      const moi: string[] = [];
      if (kho > this.canhBaoKho()) moi.push(`${kho - this.canhBaoKho()} sản phẩm sắp hết hàng chưa có phiếu nhập`);
      if (duyet > this.phieuChoDuyet()) moi.push(`${duyet - this.phieuChoDuyet()} phiếu nhập mới chờ duyệt`);
      if (nhan > this.phieuChoNhan()) moi.push(`${nhan - this.phieuChoNhan()} phiếu nhập chờ nhận hàng`);
      if (sapHetHan > this.loSapHetHan()) moi.push(`${sapHetHan - this.loSapHetHan()} lô hàng mới sắp hết hạn`);
      if (moi.length) this.hienThongBao('Có ' + moi.join('; ') + '.');
    }

    this.canhBaoKho.set(kho);
    this.canhBaoKhoTong.set(tong);
    this.loSapHetHan.set(sapHetHan);
    this.loDaLoai.set(daLoai);
    this.phieuChoDuyet.set(duyet);
    this.phieuChoNhan.set(nhan);
    this.daTai = true;

    if (this.choXem.size) {
      const moc = { ...this.daXem() };
      const nang = (k: Kenh) => {
        if (this.choXem.has(k)) moc[k] = Math.max(moc[k], this.soHienTai(k));
      };
      nang('kho');
      nang('mua');
      nang('han');
      nang('daLoai');
      this.choXem.clear();
      this.luuDaXem(moc);
    }
  }

  private soHienTai(k: Kenh): number {
    switch (k) {
      case 'kho':
        return this.canhBaoKho();
      case 'mua':
        return this.phieuChoDuyet() + this.phieuChoNhan();
      case 'han':
        return this.loSapHetHan();
      case 'daLoai':
        return this.loDaLoai();
    }
  }

  private luuDaXem(v: DaXem) {
    const id = this.auth.user()?.MaTaiKhoan ?? null;
    if (id === null) {
      this.daXem.set(v);
      return;
    }

    // Đọc lại kho trước khi ghi để không làm mất mốc khi effect chưa kịp nạp; mốc chỉ tăng
    const cu = docDaXem(Number(id));
    const moi = { ...MOC_GOC };
    for (const k of Object.keys(MOC_GOC) as Kenh[]) moi[k] = Math.max(v[k], cu[k]);

    this.daXem.set(moi);
    try {
      localStorage.setItem(`${DA_XEM_KEY}.${id}`, JSON.stringify(moi));
    } catch {
      // không lưu được thì chỉ mất trạng thái khi tải lại trang
    }
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

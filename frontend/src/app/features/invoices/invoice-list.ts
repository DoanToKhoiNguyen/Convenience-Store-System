import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { environment } from '../../../environments/environment';
import { SalesService } from '../sales/sales.service';
import { InvoiceItem } from './invoice.model';
import { InvoiceService } from './invoice.service';

type Severity = 'success' | 'warn' | 'danger' | 'secondary';

@Component({
  selector: 'app-invoice-list',
  imports: [DatePipe, DecimalPipe, ButtonModule, DialogModule, TagModule, InputTextModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Hóa đơn</h1>
        <p class="text-sm text-slate-500">{{ total() }} hóa đơn</p>
      </div>
      <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium"
          [class]="tab() === t.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          (click)="setTab(t.key)"
        >
          {{ t.label }}
        </button>
      }
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }
    @if (tab() === 'cho_thanh_toan') {
      <p class="mb-3 text-sm text-slate-500">
        Hàng trong các hóa đơn này đang được giữ. Quá 1 giờ chưa thanh toán, hóa đơn tự hủy và tồn kho được hoàn lại.
      </p>
    }

    <div class="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr class="border-b bg-slate-50 text-slate-600">
            <th class="p-3">Mã</th>
            <th class="p-3">Ngày lập</th>
            <th class="p-3">Nhân viên</th>
            <th class="p-3 text-right">Tổng tiền</th>
            <th class="p-3">Trạng thái</th>
            <th class="p-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (inv of items(); track inv.MaHoaDon) {
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="p-3 font-medium text-slate-800">#{{ inv.MaHoaDon }}</td>
              <td class="p-3">{{ inv.NgayLap | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td class="p-3">{{ inv.tai_khoan?.HoTen ?? '—' }}</td>
              <td class="p-3 text-right">{{ inv.TongTien | number: '1.0-0' }} ₫</td>
              <td class="p-3">
                <p-tag [value]="status(inv).label" [severity]="status(inv).severity" />
                @if (inv.trang_thai_text === 'cho_thanh_toan') {
                  <div class="mt-1 text-xs" [class]="isUrgent(inv) ? 'text-red-600' : 'text-slate-500'">
                    {{ remaining(inv) }}
                  </div>
                }
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <p-button label="Xem" size="small" [text]="true" (onClick)="selected.set(inv)" />
                  @if (inv.trang_thai_text === 'cho_thanh_toan') {
                    <p-button label="Thanh toán" size="small" severity="success" [disabled]="busy()" (onClick)="openPay(inv)" />
                    <p-button label="Hủy" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="cancel(inv)" />
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="p-8 text-center text-slate-500">
                {{ loading() ? 'Đang tải...' : 'Không có hóa đơn nào.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (lastPage() > 1) {
      <div class="mt-3 flex items-center justify-center gap-3 text-sm">
        <p-button label="Trước" size="small" [outlined]="true" [disabled]="page() <= 1 || loading()" (onClick)="go(page() - 1)" />
        <span>Trang {{ page() }} / {{ lastPage() }}</span>
        <p-button label="Sau" size="small" [outlined]="true" [disabled]="page() >= lastPage() || loading()" (onClick)="go(page() + 1)" />
      </div>
    }

    <!-- Chi tiết hóa đơn -->
    <p-dialog
      [header]="'Hóa đơn #' + selected()?.MaHoaDon"
      [modal]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [style]="{ width: '36rem' }"
      >
      @if (selected(); as inv) {
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <p-tag [value]="status(inv).label" [severity]="status(inv).severity" />
          <span class="text-sm text-slate-500">
            {{ inv.NgayLap | date: 'dd/MM/yyyy HH:mm' }} · {{ inv.tai_khoan?.HoTen ?? '—' }}
          </span>
        </div>

        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Sản phẩm</th>
              <th class="text-right">SL</th>
              <th class="text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            @for (l of inv.chi_tiet_hoa_don ?? []; track l.MaChiTietHoaDon) {
              <tr class="border-b border-slate-100">
                <td class="py-2">{{ l.TenSanPham }}</td>
                <td class="text-right">{{ l.SoLuong }}</td>
                <td class="text-right">{{ l.ThanhTien | number: '1.0-0' }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="mt-3 space-y-1 text-right text-sm">
  @if (discount(inv) > 0) {
    <div class="text-slate-600">Tiền hàng: {{ subtotal(inv) | number: '1.0-0' }} ₫</div>
    <div class="text-emerald-700">
      Giảm giá{{ inv.khuyen_mai ? ' (' + inv.khuyen_mai.TenChuongTrinh + ')' : '' }}:
      -{{ discount(inv) | number: '1.0-0' }} ₫
    </div>
  }
  <div class="text-base font-medium text-slate-800">Tổng thanh toán: {{ inv.TongTien | number: '1.0-0' }} ₫</div>
</div>

        @if (inv.trang_thai_text === 'da_thanh_toan') {
          <div class="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Thanh toán lúc {{ (inv.NgayThanhToan ?? inv.NgayLap) | date: 'dd/MM/yyyy HH:mm' }}
            · {{ inv.TenGiaoDich ?? '—' }}
            @if (inv.MaGiaoDich) { · Mã giao dịch: {{ inv.MaGiaoDich }} }
          </div>
        }
        @if (inv.trang_thai_text === 'da_huy') {
          <div class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Lý do hủy: {{ inv.LyDoHuy ?? '—' }}</div>
        }
        @if (inv.trang_thai_text === 'cho_thanh_toan') {
          <div class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Hạn thanh toán: {{ inv.HanThanhToan | date: 'HH:mm dd/MM/yyyy' }} ({{ remaining(inv) }})
          </div>
        }
      }

      <ng-template #footer>
        <p-button label="Đóng" [text]="true" (onClick)="selected.set(null)" />
      </ng-template>
    </p-dialog>

    <!-- Thanh toán hóa đơn trong hàng đợi -->
    <p-dialog
      header="Thanh toán hóa đơn"
      [modal]="true"
      [closable]="!busy()"
      [visible]="!!paying()"
      (visibleChange)="!$event && closePay()"
      [style]="{ width: '26rem' }"
    >
      @if (paying(); as inv) {
        <div class="space-y-3">
          <div class="text-center">
            <div class="text-sm text-slate-500">Hóa đơn #{{ inv.MaHoaDon }}</div>
            <div class="text-3xl font-semibold text-slate-800">{{ inv.TongTien | number: '1.0-0' }} ₫</div>
          </div>

          <div class="flex justify-center gap-2">
            @for (m of methods; track m) {
              <p-button [label]="m" size="small" [outlined]="method() !== m" (onClick)="method.set(m)" />
            }
          </div>

          @if (method() === 'Chuyển khoản') {
            <div class="space-y-3 text-center">
              @if (qrFailed()) {
                <div class="rounded-lg bg-red-50 px-3 py-6 text-sm text-red-700">Không tải được mã QR.</div>
              } @else {
                <img [src]="qrUrl()" alt="Mã QR" class="mx-auto w-56 rounded-lg border border-slate-200" (error)="qrFailed.set(true)" />
              }
              <div class="text-sm text-slate-600">
                {{ bank.bankId }} · {{ bank.accountNo }}<br />
                Nội dung: <b>HD{{ inv.MaHoaDon }}</b>
              </div>
              <input
                pInputText
                class="w-full"
                placeholder="Mã giao dịch (không bắt buộc)"
                [value]="txCode()"
                (input)="txCode.set($any($event.target).value)"
              />
              <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Chỉ xác nhận khi đã thấy tiền về tài khoản.
              </p>
            </div>
          } @else {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Khách đưa (₫)</label>
              <input
                pInputText
                type="number"
                min="0"
                class="w-full"
                [value]="given() ?? ''"
                (input)="given.set($any($event.target).value === '' ? null : +$any($event.target).value)"
              />
              @if (given() !== null && given()! >= amount(inv)) {
                <div class="mt-1 text-sm text-slate-600">Tiền thừa: <b>{{ given()! - amount(inv) | number: '1.0-0' }} ₫</b></div>
              }
              @if (given() !== null && given()! < amount(inv)) {
                <div class="mt-1 text-sm text-red-600">Khách đưa chưa đủ.</div>
              }
            </div>
          }
        </div>
      }

      <ng-template #footer>
        <p-button label="Đóng" [text]="true" [disabled]="busy()" (onClick)="closePay()" />
        <p-button
          label="Xác nhận đã thanh toán"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="!canConfirm()"
          (onClick)="confirmPay()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class InvoiceList {
  private service = inject(InvoiceService);
  private sales = inject(SalesService);

  readonly tabs = [
    { key: 'cho_thanh_toan', label: 'Chờ thanh toán' },
    { key: 'da_thanh_toan', label: 'Đã thanh toán' },
    { key: 'da_huy', label: 'Đã hủy' },
  ];
  readonly methods = ['Tiền mặt', 'Chuyển khoản'];
  readonly bank = environment.bank;

  readonly tab = signal('cho_thanh_toan');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly items = signal<InvoiceItem[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly selected = signal<InvoiceItem | null>(null);
  readonly paying = signal<InvoiceItem | null>(null);
  readonly method = signal('Tiền mặt');
  readonly txCode = signal('');
  readonly given = signal<number | null>(null);
  readonly qrFailed = signal(false);

  readonly now = signal(Date.now());

  readonly qrUrl = computed(() => {
    const inv = this.paying();
    if (!inv) return '';
    const b = environment.bank;
    const params = new URLSearchParams({
      amount: String(Math.round(Number(inv.TongTien))),
      addInfo: `HD${inv.MaHoaDon}`,
      accountName: b.accountName,
    });
    return `https://img.vietqr.io/image/${b.bankId}-${b.accountNo}-compact2.png?${params}`;
  });

  readonly canConfirm = computed(() => {
    const inv = this.paying();
    if (!inv || this.busy()) return false;
    const g = this.given();
    return this.method() !== 'Tiền mặt' || g === null || g >= Number(inv.TongTien);
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    this.load();
  }
  discount(inv: InvoiceItem): number {
    return Number(inv.TienGiamGia ?? 0);
  }

  subtotal(inv: InvoiceItem): number {
    return Number(inv.TongTienHang ?? inv.TongTien);
  }
  amount(inv: InvoiceItem): number {
    return Number(inv.TongTien);
  }

  status(inv: InvoiceItem): { label: string; severity: Severity } {
    switch (inv.trang_thai_text) {
      case 'da_thanh_toan':
        return { label: 'Đã thanh toán', severity: 'success' };
      case 'cho_thanh_toan':
        return { label: 'Chờ thanh toán', severity: 'warn' };
      case 'da_huy':
        return { label: 'Đã hủy', severity: 'danger' };
      default:
        return { label: 'Nháp', severity: 'secondary' };
    }
  }

  private msLeft(inv: InvoiceItem): number | null {
    return inv.HanThanhToan ? new Date(inv.HanThanhToan).getTime() - this.now() : null;
  }

  remaining(inv: InvoiceItem): string {
    const ms = this.msLeft(inv);
    if (ms === null) return '';
    if (ms <= 0) return 'Quá hạn';
    return `Còn ${Math.ceil(ms / 60000)} phút`;
  }

  isUrgent(inv: InvoiceItem): boolean {
    const ms = this.msLeft(inv);
    return ms !== null && ms <= 10 * 60000;
  }

  setTab(key: string) {
    this.tab.set(key);
    this.page.set(1);
    this.load();
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.list(this.tab(), this.page()).subscribe({
      next: (p) => {
        this.items.set(p.data);
        this.total.set(p.total);
        this.lastPage.set(p.last_page);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách hóa đơn.');
      },
    });
  }

  openPay(inv: InvoiceItem) {
    this.method.set('Tiền mặt');
    this.txCode.set('');
    this.given.set(null);
    this.qrFailed.set(false);
    this.error.set(null);
    this.paying.set(inv);
  }

  closePay() {
    if (!this.busy()) this.paying.set(null);
  }

  confirmPay() {
    const inv = this.paying();
    if (!inv) return;

    const tx = this.method() === 'Chuyển khoản' ? this.txCode().trim() || null : null;
    this.busy.set(true);
    this.error.set(null);

    this.sales.pay(inv.MaHoaDon, this.method(), tx).subscribe({
      next: () => {
        this.busy.set(false);
        this.paying.set(null);
        this.notify(`Đã thanh toán hóa đơn #${inv.MaHoaDon}.`);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.paying.set(null);
        this.error.set(e.error?.message ?? 'Thanh toán thất bại.');
        this.load();
      },
    });
  }

  cancel(inv: InvoiceItem) {
    const reason = prompt(
      `Hủy hóa đơn #${inv.MaHoaDon}? Hàng đang giữ sẽ được hoàn lại kho.\nLý do hủy:`,
      'Khách không thanh toán',
    );
    if (reason === null) return;

    this.busy.set(true);
    this.error.set(null);
    this.service.cancel(inv.MaHoaDon, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify(`Đã hủy hóa đơn #${inv.MaHoaDon} và hoàn lại tồn kho.`);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(e.error?.message ?? 'Hủy hóa đơn thất bại.');
        this.load();
      },
    });
  }

  private notify(message: string) {
    this.success.set(message);
    this.error.set(null);
    setTimeout(() => this.success.set(null), 4000);
  }
}
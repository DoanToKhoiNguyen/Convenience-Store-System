import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { environment } from '../../../environments/environment';
import { plainEnter } from '../../core/ui/enter';
import { SalesService } from '../sales/sales.service';
import { InvoiceItem } from './invoice.model';
import { InvoiceService } from './invoice.service';

type Severity = 'success' | 'warn' | 'danger' | 'secondary';

@Component({
  selector: 'app-invoice-list',
  imports: [DatePipe, DecimalPipe, ButtonModule, DialogModule, TagModule, InputTextModule],
  template: `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/20">
          <i class="pi pi-receipt text-lg"></i>
        </span>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Hóa đơn</h1>
          <p class="text-sm text-slate-500">{{ total() }} hóa đơn</p>
        </div>
      </div>
      <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
    </div>

    @if (success()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5 text-emerald-500"></i>
        <span>{{ success() }}</span>
      </div>
    }
    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
        <span>{{ error() }}</span>
      </div>
    }

    <div class="mb-4 flex w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none"
          [class]="tab() === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'"
          (click)="setTab(t.key)"
        >
          {{ t.label }}
        </button>
      }
    </div>

    @if (tab() === 'cho_thanh_toan') {
      <div class="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <i class="pi pi-clock mt-0.5 text-amber-500"></i>
        <span>
          Hàng trong các hóa đơn này đang được giữ. Quá 1 giờ chưa thanh toán, hóa đơn tự hủy và tồn kho được hoàn lại.
        </span>
      </div>
    }

    <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <i class="pi pi-list text-indigo-500"></i>
          Danh sách hóa đơn
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {{ items().length }} hóa đơn
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <th class="px-4 py-3 font-semibold">Mã</th>
              <th class="px-4 py-3 font-semibold">Ngày lập</th>
              <th class="px-4 py-3 font-semibold">Nhân viên</th>
              <th class="px-4 py-3 text-right font-semibold">Tổng tiền</th>
              <th class="px-4 py-3 font-semibold">Trạng thái</th>
              <th class="px-4 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (inv of items(); track inv.MaHoaDon) {
              <tr class="transition-colors hover:bg-indigo-100/60">
                <td class="px-4 py-3.5">
                  <span class="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                    #{{ inv.MaHoaDon }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-slate-600">{{ inv.NgayLap | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-2 text-slate-700">
                    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <i class="pi pi-user text-[11px]"></i>
                    </span>
                    <span class="truncate">{{ inv.tai_khoan?.HoTen ?? '—' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                  {{ inv.TongTien | number: '1.0-0' }} ₫
                </td>
                <td class="px-4 py-3.5">
                  <p-tag [value]="status(inv).label" [severity]="status(inv).severity" />
                  @if (inv.trang_thai_text === 'cho_thanh_toan') {
                    <div class="mt-1 flex items-center gap-1 text-xs" [class]="isUrgent(inv) ? 'text-red-600' : 'text-slate-500'">
                      <i class="pi pi-clock text-[10px]"></i>
                      {{ remaining(inv) }}
                    </div>
                  }
                </td>
                <td class="px-4 py-3.5 text-right">
                  <div class="flex justify-end gap-1">
                    <p-button label="Xem" icon="pi pi-eye" size="small" [outlined]="true" (onClick)="selected.set(inv)" />
                    @if (inv.trang_thai_text === 'cho_thanh_toan') {
                      <p-button
                        label="Thanh toán"
                        icon="pi pi-check"
                        size="small"
                        severity="success"
                        [disabled]="busy()"
                        (onClick)="openPay(inv)"
                      />
                      <p-button
                        label="Hủy"
                        icon="pi pi-times"
                        size="small"
                        severity="danger"
                        [text]="true"
                        [disabled]="busy()"
                        (onClick)="cancel(inv)"
                      />
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-16 text-center">
                  @if (loading()) {
                    <div class="flex flex-col items-center gap-3 text-slate-500">
                      <i class="pi pi-spin pi-spinner text-2xl text-indigo-500"></i>
                      <span class="text-sm">Đang tải hóa đơn...</span>
                    </div>
                  } @else {
                    <div class="flex flex-col items-center gap-3 text-slate-500">
                      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <i class="pi pi-inbox text-xl"></i>
                      </span>
                      <span class="text-sm">Không có hóa đơn nào.</span>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (lastPage() > 1) {
      <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p-button
          label="Trước"
          icon="pi pi-angle-left"
          size="small"
          [outlined]="true"
          [disabled]="page() <= 1 || loading()"
          (onClick)="go(page() - 1)"
        />
        <span class="text-slate-600">Trang <b class="text-slate-800">{{ page() }}</b> / {{ lastPage() }}</span>
        <p-button
          label="Sau"
          icon="pi pi-angle-right"
          iconPos="right"
          size="small"
          [outlined]="true"
          [disabled]="page() >= lastPage() || loading()"
          (onClick)="go(page() + 1)"
        />
      </div>
    }

    <!-- Chi tiết hóa đơn -->
    <p-dialog
      [header]="'Hóa đơn #' + selected()?.MaHoaDon"
      [modal]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [style]="{ width: '36rem', maxWidth: '94vw' }"
    >
      @if (selected(); as inv) {
        <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p-tag [value]="status(inv).label" [severity]="status(inv).severity" />
          <span class="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <i class="pi pi-clock text-xs text-slate-400"></i>
            {{ inv.NgayLap | date: 'dd/MM/yyyy HH:mm' }}
          </span>
          <span class="text-slate-300">·</span>
          <span class="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <i class="pi pi-user text-xs text-slate-400"></i>
            {{ inv.tai_khoan?.HoTen ?? '—' }}
          </span>
        </div>

        <div class="overflow-hidden rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th class="px-3 py-2.5 text-left font-semibold">Sản phẩm</th>
                <th class="px-3 py-2.5 text-right font-semibold">SL</th>
                <th class="px-3 py-2.5 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (l of inv.chi_tiet_hoa_don ?? []; track l.MaChiTietHoaDon) {
                <tr class="transition-colors hover:bg-indigo-50/70">
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-2.5">
                      @if (l.san_pham?.hinh_anh_url) {
                        <img
                          [src]="l.san_pham?.hinh_anh_url ?? ''"
                          [alt]="l.TenSanPham"
                          class="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                        />
                      } @else {
                        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <i class="pi pi-image text-xs"></i>
                        </div>
                      }
                      <span class="text-slate-700">{{ l.TenSanPham }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-slate-600">{{ l.SoLuong }}</td>
                  <td class="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800">
                    {{ l.ThanhTien | number: '1.0-0' }} ₫
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mt-3 overflow-hidden rounded-xl border border-slate-200 text-sm">
          <div class="divide-y divide-slate-100">
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-slate-500">Tiền hàng</span>
              <span class="tabular-nums text-slate-700">{{ subtotal(inv) | number: '1.0-0' }} ₫</span>
            </div>
            @if (discount(inv) > 0) {
              <div class="flex items-center justify-between gap-3 px-4 py-2.5">
                <span class="min-w-0 text-indigo-700">
                  Giảm giá
                  @if (inv.khuyen_mai) {
                    <span class="block truncate text-xs text-indigo-600/80">{{ inv.khuyen_mai.TenChuongTrinh }}</span>
                  }
                </span>
                <span class="shrink-0 font-medium tabular-nums text-indigo-700">
                  -{{ discount(inv) | number: '1.0-0' }} ₫
                </span>
              </div>
            }
          </div>
          <div class="flex items-center justify-between bg-indigo-50/70 px-4 py-3">
            <span class="font-semibold text-slate-800">Tổng thanh toán</span>
            <span class="text-base font-bold tabular-nums text-indigo-700">{{ inv.TongTien | number: '1.0-0' }} ₫</span>
          </div>
        </div>

        @if (inv.trang_thai_text === 'da_thanh_toan') {
          <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <i class="pi pi-check-circle mt-0.5 text-emerald-500"></i>
            <span>
              Thanh toán lúc {{ (inv.NgayThanhToan ?? inv.NgayLap) | date: 'dd/MM/yyyy HH:mm' }}
              · {{ inv.TenGiaoDich ?? '—' }}
              @if (inv.MaGiaoDich) { · Mã giao dịch: {{ inv.MaGiaoDich }} }
            </span>
          </div>
        }
        @if (inv.trang_thai_text === 'da_huy') {
          <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <i class="pi pi-times-circle mt-0.5 text-red-500"></i>
            <span>Lý do hủy: {{ inv.LyDoHuy ?? '—' }}</span>
          </div>
        }
        @if (inv.trang_thai_text === 'cho_thanh_toan') {
          <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <i class="pi pi-clock mt-0.5 text-amber-500"></i>
            <span>Hạn thanh toán: {{ inv.HanThanhToan | date: 'HH:mm dd/MM/yyyy' }} ({{ remaining(inv) }})</span>
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
      (keydown.enter)="onEnter($event)"
      [style]="{ width: '26rem', maxWidth: '92vw' }"
    >
      @if (paying(); as inv) {
        <div class="space-y-4">
          <div class="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-4 text-white shadow-lg shadow-indigo-600/20">
            <div class="flex items-center justify-between text-xs text-indigo-100">
              <span>Hóa đơn #{{ inv.MaHoaDon }}</span>
              <i class="pi pi-credit-card"></i>
            </div>
            <div class="mt-1 text-center text-3xl font-semibold tracking-tight tabular-nums">
              {{ inv.TongTien | number: '1.0-0' }} ₫
            </div>
          </div>

          <div class="flex justify-center gap-2">
            @for (m of methods; track m) {
              <p-button [label]="m" size="small" [outlined]="method() !== m" (onClick)="method.set(m)" />
            }
          </div>

          @if (method() === 'Chuyển khoản') {
            <div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-center">
              @if (qrFailed()) {
                <div class="flex flex-col items-center gap-2 rounded-xl bg-red-50 px-3 py-6 text-sm text-red-700">
                  <i class="pi pi-exclamation-circle text-xl text-red-500"></i>
                  Không tải được mã QR.
                </div>
              } @else {
                <img
                  [src]="qrUrl()"
                  alt="Mã QR"
                  class="mx-auto w-56 rounded-xl border border-slate-200 shadow-sm"
                  (error)="qrFailed.set(true)"
                />
              }
              <div class="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <div>{{ bank.bankId }} · {{ bank.accountNo }}</div>
                <div class="mt-0.5">Nội dung: <b class="text-slate-800">HD{{ inv.MaHoaDon }}</b></div>
              </div>
              <input
                pInputText
                class="w-full"
                placeholder="Mã giao dịch (không bắt buộc)"
                [value]="txCode()"
                (input)="txCode.set($any($event.target).value)"
              />
              <p class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
                <i class="pi pi-info-circle mt-px shrink-0 text-amber-500"></i>
                <span>Chỉ xác nhận khi đã thấy tiền về tài khoản.</span>
              </p>
            </div>
          } @else {
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700">Khách đưa (₫)</label>
              <input
                pInputText
                type="number"
                min="0"
                class="w-full"
                [value]="given() ?? ''"
                (input)="given.set($any($event.target).value === '' ? null : +$any($event.target).value)"
              />
              @if (given() !== null && given()! >= amount(inv)) {
                <div class="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                  <span>Tiền thừa</span>
                  <b class="tabular-nums">{{ given()! - amount(inv) | number: '1.0-0' }} ₫</b>
                </div>
              }
              @if (given() !== null && given()! < amount(inv)) {
                <div class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <i class="pi pi-exclamation-circle text-red-500"></i>
                  <span>Khách đưa chưa đủ.</span>
                </div>
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

  onEnter(e: Event) {
    if (!plainEnter(e) || !this.canConfirm() || this.busy()) return;
    e.preventDefault();
    this.confirmPay();
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
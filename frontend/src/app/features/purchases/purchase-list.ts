import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { PurchaseCounts, PurchaseDetail, PurchaseOrder } from './purchase.model';
import { PurchaseService } from './purchase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { formatDate } from '../shifts/week.util';

type Severity = 'warn' | 'info' | 'danger' | 'success';

const STATUS: Record<number, { label: string; severity: Severity }> = {
  1: { label: 'Chờ duyệt', severity: 'warn' },
  2: { label: 'Đã duyệt', severity: 'info' },
  3: { label: 'Đã hủy', severity: 'danger' },
  4: { label: 'Đã nhận hàng', severity: 'success' },
};

@Component({
  selector: 'app-purchase-list',
  imports: [TableModule, TagModule, ButtonModule, DialogModule, ConfirmDialogModule, DatePipe, DecimalPipe],
  providers: [ConfirmationService],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-truck text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Phiếu nhập</h1>
          <p class="text-sm text-slate-500">{{ total() }} phiếu</p>
        </div>
      </div>
    </div>

    @if (success()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5"></i>
        <span>{{ success() }}</span>
      </div>
    }
    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <i class="pi pi-exclamation-circle mt-0.5"></i>
        <span>{{ error() }}</span>
      </div>
    }

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="mr-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <i class="pi pi-filter text-[11px]"></i>
        Lọc theo trạng thái
      </span>
      @for (t of tags(); track t.label) {
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
          [class]="statusFilter() === t.value
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'"
          (click)="chonTag(t.value)"
        >
          <i [class]="t.icon" class="text-[11px]"></i>
          {{ t.label }}
          <span
            class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
            [class]="statusFilter() === t.value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ t.count }}
          </span>
        </button>
      }
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <i class="pi pi-list text-emerald-500"></i>
          Danh sách phiếu nhập
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ total() }}</span>
        </div>
      </div>

      <p-table
        [value]="orders()"
        [lazy]="true"
        [paginator]="true"
        [rows]="10"
        [totalRecords]="total()"
        [first]="first()"
        [loading]="loading()"
        (onLazyLoad)="onLazyLoad($event)"
        dataKey="MaPhieuNhap"
        [tableStyle]="{ 'min-width': '56rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mã phiếu</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ngày lập</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sản phẩm</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng giá trị</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="px-4 py-3 text-center! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-o>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-xs font-medium text-emerald-700">
                {{ o.MaPhieuNhap }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-600">
              <span class="inline-flex items-center gap-1.5">
                <i class="pi pi-calendar text-[11px] text-slate-400"></i>
                {{ o.NgayLap | date: 'dd/MM/yyyy HH:mm' }}
              </span>
            </td>
            <td class="px-4 py-3">
              @if (dongDau(o); as d) {
                <div class="flex items-center gap-2.5">
                  <div class="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70">
                    @if (anh(d); as url) {
                      <img [src]="url" alt="" class="h-full w-full object-cover" />
                    } @else {
                      <div class="flex h-full w-full items-center justify-center text-slate-400">
                        <i class="pi pi-image text-xs"></i>
                      </div>
                    }
                  </div>
                  <div class="min-w-0">
                    <div class="max-w-[16rem] truncate font-medium text-slate-800">{{ d.TenSanPham }}</div>
                    <div class="text-xs text-slate-500">
                      SL {{ tongSoLuong(o) }}
                      @if (soMatHangKhac(o) > 0) {
                        · {{ soMatHangKhac(o) }} mặt hàng khác
                      }
                    </div>
                  </div>
                </div>
              } @else {
                <span class="text-slate-400">—</span>
              }
            </td>
            <td class="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{{ o.TongGiaTri | number: '1.0-0' }} ₫</td>
            <td class="px-4 py-3"><p-tag [value]="status(o).label" [severity]="status(o).severity" /></td>
            <td class="px-4 py-3 text-center">
              <div class="flex items-center justify-center gap-1">
                @if (!canApprove() && o.TrangThai === 2) {
                  <p-button label="Nhận hàng" size="small" [disabled]="busy()" (onClick)="openReceive(o)" />
                } @else {
                  <p-button label="Xem" size="small" [text]="true" (onClick)="openView(o)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="px-4 py-12">
              @if (loading()) {
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-emerald-500"></i>
                  <span class="text-sm">Đang tải...</span>
                </div>
              } @else {
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <i class="pi pi-inbox text-xl"></i>
                  </div>
                  <span class="text-sm text-slate-500">
                    {{ statusFilter() !== null ? 'Không có phiếu ở trạng thái này.' : 'Chưa có phiếu nhập nào.' }}
                  </span>
                </div>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="dialogTitle()"
      [modal]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [style]="{ width: '42rem', maxWidth: '94vw' }"
    >
      @if (selected(); as o) {
        <div class="mb-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
          <div class="mb-2.5 flex flex-wrap items-center gap-1.5 border-b border-slate-200/70 pb-2.5 text-sm text-slate-600">
            <i class="pi pi-building text-xs text-slate-400"></i>
            Nhà cung cấp: <b class="text-slate-800">{{ o.nha_cung_cap?.TenNhaCungCap ?? '—' }}</b>
          </div>
          <div class="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
            @for (t of thongTin(); track t.label) {
              <div class="flex items-start gap-2">
                <i [class]="t.icon" class="mt-0.5 text-[11px] text-slate-400"></i>
                <div class="min-w-0">
                  <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{{ t.label }}</div>
                  <div class="truncate text-slate-700">{{ t.value }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        @if (mode() === 'receive') {
          <div class="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <i class="pi pi-calendar-plus mt-0.5 text-[11px]"></i>
            <span>Nhập hạn sử dụng in trên bao bì cho từng dòng (để trống nếu hàng không có hạn). Mỗi dòng sẽ tạo một lô hàng riêng.</span>
          </div>
        }

        <div class="overflow-hidden rounded-xl border border-slate-200/70">
          <table class="w-full text-sm">
            <thead class="bg-slate-50/80">
              <tr class="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                @if (mode() === 'view') {
                  <th class="px-4 py-2 text-left font-semibold">Lô</th>
                }
                <th class="px-4 py-2 text-left font-semibold">Sản phẩm</th>
                <th class="px-4 py-2 text-right font-semibold">SL</th>
                <th class="px-4 py-2 text-right font-semibold">Đơn giá</th>
                <th class="px-4 py-2 text-right font-semibold">Thành tiền</th>
                @if (mode() === 'receive') {
                  <th class="px-4 py-2 text-left font-semibold">Hạn sử dụng</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (d of o.chi_tiet_phieu_nhap ?? []; track d.MaChiTietPhieuNhap) {
                <tr class="transition-colors hover:bg-emerald-50/40">
                  @if (mode() === 'view') {
                    <td class="px-4 py-2 text-slate-600">{{ d.lo_hang ? d.lo_hang.MaLo : '—' }}</td>
                  }
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                      <div class="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/70">
                        @if (anh(d); as url) {
                          <img [src]="url" alt="" class="h-full w-full object-cover" />
                        } @else {
                          <div class="flex h-full w-full items-center justify-center text-slate-400">
                            <i class="pi pi-image text-[10px]"></i>
                          </div>
                        }
                      </div>
                      <span class="text-slate-700">{{ d.TenSanPham }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums text-slate-700">{{ d.SoLuong }}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-slate-700">{{ d.DonGia | number: '1.0-0' }}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-slate-800">{{ d.TongGia | number: '1.0-0' }}</td>

                  @if (mode() === 'receive') {
                    <td class="px-4 py-2">
                      <input
                        type="date"
                        class="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        [min]="today"
                        [value]="dates()[d.MaChiTietPhieuNhap] ?? ''"
                        (input)="setDate(d.MaChiTietPhieuNhap, $any($event.target).value)"
                      />
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mt-3 flex items-center justify-end gap-2 text-sm">
          <span class="text-slate-500">Tổng:</span>
          <span class="text-base font-semibold tabular-nums text-emerald-700">{{ o.TongGiaTri | number: '1.0-0' }} ₫</span>
        </div>
      }

      <ng-template #footer>
        @if (selected(); as o) {
          @if (mode() === 'view' && canApprove()) {
            @if (o.TrangThai === 1 || o.TrangThai === 2) {
              <p-button
                label="Hủy phiếu"
                icon="pi pi-times"
                severity="danger"
                [text]="true"
                [disabled]="busy()"
                (onClick)="cancel(o)"
              />
            }
            @if (o.TrangThai === 1) {
              <p-button
                label="Duyệt phiếu"
                icon="pi pi-check"
                severity="success"
                [loading]="busy()"
                [disabled]="busy()"
                (onClick)="approve(o)"
              />
            }
            @if (o.TrangThai === 2) {
              <p-button
                label="Nhận hàng"
                icon="pi pi-truck"
                [disabled]="busy()"
                (onClick)="openReceive(o)"
              />
            }
          }
        }

        <p-button label="Đóng" [text]="true" (onClick)="selected.set(null)" />

        @if (mode() === 'receive') {
          <p-button
            label="Xác nhận nhận hàng"
            icon="pi pi-check"
            [disabled]="!canConfirm() || busy()"
            [loading]="busy()"
            (onClick)="confirmReceive()"
          />
        }
      </ng-template>
    </p-dialog>

    <p-confirmdialog />
  `,
})
export class PurchaseList {
  private service = inject(PurchaseService);

  private auth = inject(AuthService);
  private confirm = inject(ConfirmationService);
  // Chỉ chủ và quản lý được duyệt, hủy. Nhân viên chỉ xem và nhận hàng.
  readonly canApprove = computed(() => this.auth.hasAnyRole([ROLE.OWNER, ROLE.MANAGER]));

  readonly orders = signal<PurchaseOrder[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly counts = signal<PurchaseCounts>({ tong: 0, cho_duyet: 0, cho_nhan: 0, da_huy: 0, da_nhan: 0 });
  readonly statusFilter = signal<number | null>(null);
  readonly first = signal(0);

  readonly selected = signal<PurchaseOrder | null>(null);
  readonly mode = signal<'view' | 'receive'>('view');
  readonly dates = signal<Record<number, string>>({});
  readonly today = formatDate(new Date());

  private page = 1;

  readonly dialogTitle = computed(() => {
    const id = this.selected()?.MaPhieuNhap;
    return this.mode() === 'receive' ? `Nhận hàng - phiếu ${id}` : `Chi tiết phiếu ${id}`;
  });

  // Thông tin đầu phiếu: ngày lập, ngày nhận, người lập / duyệt / nhận
  readonly thongTin = computed(() => {
    const o = this.selected();
    if (!o) return [];
    return [
      { icon: 'pi pi-calendar', label: 'Ngày lập', value: this.dinhDangNgay(o.NgayLap) },
      { icon: 'pi pi-calendar-check', label: 'Ngày nhận', value: this.dinhDangNgay(o.NgayNhan) },
      { icon: 'pi pi-user', label: 'Người lập phiếu', value: o.taikhoan?.HoTen ?? '—' },
      { icon: 'pi pi-verified', label: 'Người duyệt phiếu', value: o.nguoi_duyet?.HoTen ?? '—' },
      { icon: 'pi pi-inbox', label: 'Người nhận hàng', value: o.nguoi_nhan?.HoTen ?? '—' },
    ];
  });

  // Cột "Sản phẩm" của danh sách: mặt hàng đầu tiên kèm ảnh và tổng số lượng
  dongDau(o: PurchaseOrder): PurchaseDetail | null {
    return o.chi_tiet_phieu_nhap?.[0] ?? null;
  }

  anh(d: PurchaseDetail | null): string | null {
    return d?.san_pham?.hinh_anh_url ?? null;
  }

  tongSoLuong(o: PurchaseOrder): number {
    return (o.chi_tiet_phieu_nhap ?? []).reduce((s, d) => s + Number(d.SoLuong), 0);
  }

  soMatHangKhac(o: PurchaseOrder): number {
    return Math.max((o.chi_tiet_phieu_nhap?.length ?? 0) - 1, 0);
  }

  private dinhDangNgay(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(String(v).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return v;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Tag trạng thái: chỉ hiện trạng thái có phiếu (hoặc đang được chọn)
  readonly tags = computed(() => {
    const c = this.counts();
    const all: { value: number | null; label: string; count: number; icon: string }[] = [
      { value: null, label: 'Tất cả', count: c.tong, icon: 'pi pi-list' },
      { value: 1, label: 'Chờ duyệt', count: c.cho_duyet, icon: 'pi pi-clock' },
      { value: 2, label: 'Chờ nhận hàng', count: c.cho_nhan, icon: 'pi pi-inbox' },
      { value: 4, label: 'Đã nhận hàng', count: c.da_nhan, icon: 'pi pi-check-circle' },
      { value: 3, label: 'Đã hủy', count: c.da_huy, icon: 'pi pi-times-circle' },
    ];

    return all.filter((t) => t.value === null || t.count > 0 || this.statusFilter() === t.value);
  });

  readonly canConfirm = computed(() => {
    const lines = this.selected()?.chi_tiet_phieu_nhap ?? [];
    const d = this.dates();
    return lines.length > 0;
  });

  status(o: PurchaseOrder) {
    return STATUS[o.TrangThai] ?? { label: 'Không rõ', severity: 'info' as Severity };
  }

  chonTag(value: number | null) {
    if (this.statusFilter() === value) return;
    this.statusFilter.set(value);
    this.first.set(0);
    this.page = 1;
    this.load();
  }

  onLazyLoad(e: TableLazyLoadEvent) {
    this.first.set(e.first ?? 0);
    this.page = Math.floor((e.first ?? 0) / (e.rows ?? 10)) + 1;
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.list(this.page, this.statusFilter()).subscribe({
      next: (p) => {
        this.orders.set(p.data ?? []);
        this.total.set(p.total ?? 0);
        if (p.counts) this.counts.set(p.counts);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.fail(e, 'Không tải được danh sách phiếu nhập.');
      },
    });
  }

  openView(o: PurchaseOrder) {
    this.mode.set('view');
    this.selected.set(o);
  }

  openReceive(o: PurchaseOrder) {
    this.dates.set({});
    this.mode.set('receive');
    this.selected.set(o);
  }

  setDate(id: number, value: string) {
    this.dates.update((d) => ({ ...d, [id]: value }));
  }

  approve(o: PurchaseOrder) {
    this.confirm.confirm({
      header: 'Duyệt phiếu nhập',
      message: `Duyệt phiếu nhập ${o.MaPhieuNhap}?`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Duyệt',
      rejectLabel: 'Hủy',
      accept: () =>
        this.run(this.service.approve(o.MaPhieuNhap), 'Đã duyệt phiếu nhập.', () =>
          this.selected.set(null),
        ),
    });
  }

  cancel(o: PurchaseOrder) {
    this.confirm.confirm({
      header: 'Hủy phiếu nhập',
      message: `Hủy phiếu nhập ${o.MaPhieuNhap}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Hủy phiếu',
      rejectLabel: 'Không',
      accept: () =>
        this.run(this.service.cancel(o.MaPhieuNhap), 'Đã hủy phiếu nhập.', () =>
          this.selected.set(null),
        ),
    });
  }

  confirmReceive() {
    const o = this.selected();
    if (!o) return;
    const items = (o.chi_tiet_phieu_nhap ?? []).map((l) => ({
      MaChiTietPhieuNhap: l.MaChiTietPhieuNhap,
      HanSuDung: this.dates()[l.MaChiTietPhieuNhap] || null,
    }));
    this.run(this.service.receive(o.MaPhieuNhap, items), 'Đã nhận hàng và cộng tồn kho.', () =>
      this.selected.set(null),
    );
  }

  private run(request: Observable<unknown>, okMessage: string, after?: () => void) {
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(okMessage);
        after?.();
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.fail(e, 'Thao tác thất bại.');
      },
    });
  }

  private fail(e: HttpErrorResponse, fallback: string) {
    this.error.set(e.error?.message ?? fallback);
  }
}
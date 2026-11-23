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
import { PurchaseOrder } from './purchase.model';
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
        [loading]="loading()"
        (onLazyLoad)="onLazyLoad($event)"
        dataKey="MaPhieuNhap"
        [tableStyle]="{ 'min-width': '50rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mã phiếu</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ngày lập</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nhà cung cấp</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng giá trị</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="px-4 py-3 text-center! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-o>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-xs font-medium text-emerald-700">
                #{{ o.MaPhieuNhap }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-600">
              <span class="inline-flex items-center gap-1.5">
                <i class="pi pi-calendar text-[11px] text-slate-400"></i>
                {{ o.NgayLap | date: 'dd/MM/yyyy HH:mm' }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-700">
              <span class="inline-flex items-center gap-1.5">
                <i class="pi pi-building text-[11px] text-slate-400"></i>
                {{ o.nha_cung_cap?.TenNhaCungCap ?? '—' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{{ o.TongGiaTri | number: '1.0-0' }} ₫</td>
            <td class="px-4 py-3"><p-tag [value]="status(o).label" [severity]="status(o).severity" /></td>
            <td class="px-4 py-3 text-center">
              <div class="flex items-center justify-center gap-1">
                <p-button label="Xem" size="small" [text]="true" (onClick)="openView(o)" />

                @if (!canApprove() && o.TrangThai === 2) {
                  <p-button label="Nhận hàng" size="small" [disabled]="busy()" (onClick)="openReceive(o)" />
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
                  <span class="text-sm text-slate-500">Chưa có phiếu nhập nào.</span>
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
        <div class="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 text-sm text-slate-600">
          <i class="pi pi-building text-xs text-slate-400"></i>
          Nhà cung cấp: <b class="text-slate-800">{{ o.nha_cung_cap?.TenNhaCungCap ?? '—' }}</b>
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
                  <td class="px-4 py-2 text-slate-700">{{ d.TenSanPham }}</td>
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

  readonly selected = signal<PurchaseOrder | null>(null);
  readonly mode = signal<'view' | 'receive'>('view');
  readonly dates = signal<Record<number, string>>({});
  readonly today = formatDate(new Date());

  private page = 1;

  readonly dialogTitle = computed(() => {
    const id = this.selected()?.MaPhieuNhap;
    return this.mode() === 'receive' ? `Nhận hàng - phiếu #${id}` : `Chi tiết phiếu #${id}`;
  });

  readonly canConfirm = computed(() => {
    const lines = this.selected()?.chi_tiet_phieu_nhap ?? [];
    const d = this.dates();
    return lines.length > 0;
  });

  status(o: PurchaseOrder) {
    return STATUS[o.TrangThai] ?? { label: 'Không rõ', severity: 'info' as Severity };
  }

  onLazyLoad(e: TableLazyLoadEvent) {
    this.page = Math.floor((e.first ?? 0) / (e.rows ?? 10)) + 1;
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.list(this.page).subscribe({
      next: (p) => {
        this.orders.set(p.data ?? []);
        this.total.set(p.total ?? 0);
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
      message: `Duyệt phiếu nhập #${o.MaPhieuNhap}?`,
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
      message: `Hủy phiếu nhập #${o.MaPhieuNhap}?`,
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
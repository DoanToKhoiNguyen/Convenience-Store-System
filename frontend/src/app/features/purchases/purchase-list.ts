import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PurchaseOrder } from './purchase.model';
import { PurchaseService } from './purchase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';

type Severity = 'warn' | 'info' | 'danger' | 'success';

const STATUS: Record<number, { label: string; severity: Severity }> = {
  1: { label: 'Chờ duyệt', severity: 'warn' },
  2: { label: 'Đã duyệt', severity: 'info' },
  3: { label: 'Đã hủy', severity: 'danger' },
  4: { label: 'Đã nhận hàng', severity: 'success' },
};

@Component({
  selector: 'app-purchase-list',
  imports: [TableModule, TagModule, ButtonModule, DialogModule, DatePipe, DecimalPipe],
  template: `
    <div class="mb-4">
      <h1 class="text-2xl font-semibold text-slate-800">Phiếu nhập</h1>
      <p class="text-sm text-slate-500">{{ total() }} phiếu</p>
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="rounded-xl bg-white p-2 shadow-sm">
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
          <tr>
            <th>Mã phiếu</th>
            <th>Ngày lập</th>
            <th>Nhà cung cấp</th>
            <th class="text-right">Tổng giá trị</th>
            <th>Trạng thái</th>
            <th class="text-right">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-o>
          <tr>
            <td>#{{ o.MaPhieuNhap }}</td>
            <td>{{ o.NgayLap | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ o.nha_cung_cap?.TenNhaCungCap ?? '—' }}</td>
            <td class="text-right">{{ o.TongGiaTri | number: '1.0-0' }} ₫</td>
            <td><p-tag [value]="status(o).label" [severity]="status(o).severity" /></td>
            <td class="text-center">
              <div class="flex justify-center items-center gap-1">
                <p-button label="Xem" size="small" [text]="true" (onClick)="openView(o)" />

                @if (!canApprove() && o.TrangThai === 2) {
                  <p-button label="Nhận hàng" size="small" [disabled]="busy()" (onClick)="openReceive(o)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr><td colspan="6" class="py-8 text-center text-slate-500">Chưa có phiếu nhập nào.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="dialogTitle()"
      [modal]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [style]="{ width: '42rem' }"
    >
      @if (selected(); as o) {
        <p class="mb-3 text-sm text-slate-500">
          Nhà cung cấp: <b class="text-slate-700">{{ o.nha_cung_cap?.TenNhaCungCap ?? '—' }}</b>
        </p>

        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Sản phẩm</th>
              <th class="text-right">SL</th>
              <th class="text-right">Đơn giá</th>
              <th class="text-right">Thành tiền</th>
              @if (mode() === 'receive') {
                <th class="pl-4">Ngày sản xuất</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (d of o.chi_tiet_phieu_nhap ?? []; track d.MaChiTietPhieuNhap) {
              <tr class="border-b border-slate-100">
                <td class="py-2">{{ d.TenSanPham }}</td>
                <td class="text-right">{{ d.SoLuong }}</td>
                <td class="text-right">{{ d.DonGia | number: '1.0-0' }}</td>
                <td class="text-right">{{ d.TongGia | number: '1.0-0' }}</td>
                @if (mode() === 'receive') {
                  <td class="pl-4">
                    <input
                      type="date"
                      class="rounded border border-slate-300 px-2 py-1"
                      [max]="today"
                      [value]="dates()[d.MaChiTietPhieuNhap] ?? ''"
                      (input)="setDate(d.MaChiTietPhieuNhap, $any($event.target).value)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <div class="mt-3 text-right font-medium text-slate-800">
          Tổng: {{ o.TongGiaTri | number: '1.0-0' }} ₫
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
  `,
})
export class PurchaseList {
  private service = inject(PurchaseService);

  private auth = inject(AuthService);
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
  readonly today = new Date().toISOString().slice(0, 10);

  private page = 1;

  readonly dialogTitle = computed(() => {
    const id = this.selected()?.MaPhieuNhap;
    return this.mode() === 'receive' ? `Nhận hàng - phiếu #${id}` : `Chi tiết phiếu #${id}`;
  });

  readonly canConfirm = computed(() => {
    const lines = this.selected()?.chi_tiet_phieu_nhap ?? [];
    const d = this.dates();
    return lines.length > 0 && lines.every((l) => !!d[l.MaChiTietPhieuNhap]);
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
        this.orders.set(p.data);
        this.total.set(p.total);
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
    if (!confirm(`Duyệt phiếu nhập #${o.MaPhieuNhap}?`)) return;
    this.run(this.service.approve(o.MaPhieuNhap), 'Đã duyệt phiếu nhập.', () =>
      this.selected.set(null),
    );
  }

  cancel(o: PurchaseOrder) {
    if (!confirm(`Hủy phiếu nhập #${o.MaPhieuNhap}?`)) return;
    this.run(this.service.cancel(o.MaPhieuNhap), 'Đã hủy phiếu nhập.', () =>
      this.selected.set(null),
    );
  }

  confirmReceive() {
    const o = this.selected();
    if (!o) return;
    const items = (o.chi_tiet_phieu_nhap ?? []).map((l) => ({
      MaChiTietPhieuNhap: l.MaChiTietPhieuNhap,
      NgaySanXuat: this.dates()[l.MaChiTietPhieuNhap],
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
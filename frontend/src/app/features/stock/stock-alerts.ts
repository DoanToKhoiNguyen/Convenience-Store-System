import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AlertProduct } from './stock.model';
import { StockService } from './stock.service';

const key = (p: AlertProduct) => String(p.MaSanPham);

interface Line {
  product: AlertProduct;
  qty: number;
  cost: number | null;
}

interface Group {
  supplierId: number;
  supplierName: string;
  lines: Line[];
  total: number | null;
}

@Component({
  selector: 'app-stock-alerts',
  imports: [TableModule, TagModule, ButtonModule, DialogModule, DecimalPipe],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Cảnh báo tồn kho</h1>
        <p class="text-sm text-slate-500">Sản phẩm có số lượng thấp hơn hoặc bằng mức tồn tối thiểu</p>
      </div>
      <div class="flex gap-2">
        <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
        <p-button
          [label]="'Lập phiếu nhập hàng (' + selectedItems().length + ')'"
          icon="pi pi-truck"
          [disabled]="!canOrder()"
          (onClick)="dialogOpen.set(true)"
        />
      </div>
    </div>

    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Hết hàng</div>
        <div class="text-2xl font-semibold text-red-600">{{ outOfStock() }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Sắp hết</div>
        <div class="text-2xl font-semibold text-amber-600">{{ items().length - outOfStock() }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Đã chọn để nhập</div>
        <div class="text-2xl font-semibold text-slate-800">{{ selectedItems().length }}</div>
      </div>
    </div>

    @if (success().length) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <div class="font-medium">Đã lập phiếu nhập (đang chờ quản lý duyệt):</div>
        <ul class="ml-5 list-disc">
          @for (m of success(); track m) {
            <li>{{ m }}</li>
          }
        </ul>
      </div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="rounded-xl bg-white p-2 shadow-sm">
      <p-table
        [value]="items()"
        [loading]="loading()"
        dataKey="MaSanPham"
        [tableStyle]="{ 'min-width': '56rem' }"
      >
        <ng-template #header>
          <tr>
            <th class="w-12">
              <input
                type="checkbox"
                class="h-4 w-4"
                [checked]="allSelected()"
                [disabled]="selectable().length === 0"
                (change)="toggleAll()"
              />
            </th>
            <th>Sản phẩm</th>
            <th>Nhà cung cấp</th>
            <th class="text-right">Tồn hiện tại</th>
            <th class="text-right">Tối thiểu</th>
            <th>Trạng thái</th>
            <th class="text-right">Số lượng cần nhập</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr>
            <td>
              <input
                type="checkbox"
                class="h-4 w-4"
                [checked]="isSelected(p)"
                [disabled]="!canSelect(p)"
                (change)="toggle(p)"
              />
            </td>
            <td>
              <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
              @if (p.TenThuongHieu) {
                <div class="text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
              }
            </td>
            <td>
              @if (p.nha_cung_cap) {
                {{ p.nha_cung_cap.TenNhaCungCap }}
              } @else {
                <span class="text-red-600">Chưa có nhà cung cấp</span>
              }
            </td>
            <td class="text-right font-medium">{{ p.SoLuongHienTai }}</td>
            <td class="text-right">{{ p.TonKhoToiThieu }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                <p-tag
                  [value]="p.SoLuongHienTai <= 0 ? 'Hết hàng' : 'Sắp hết'"
                  [severity]="p.SoLuongHienTai <= 0 ? 'danger' : 'warn'"
                />
                @if (isPending(p)) {
                  <p-tag value="Đã lập phiếu nhập" severity="info" />
                }
              </div>
            </td>
            <td class="text-right">
              <input
                type="number"
                min="1"
                class="w-24 rounded border px-2 py-1 text-right disabled:bg-slate-100"
                [class.border-slate-300]="!(isSelected(p) && qtyOf(p) < 1)"
                [class.border-red-500]="isSelected(p) && qtyOf(p) < 1"
                [value]="qtyOf(p)"
                [disabled]="!isSelected(p)"
                (input)="setQty(p, $any($event.target).value)"
              />
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-500">
              Không có sản phẩm nào sắp hết hàng.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      Số lượng cần nhập được gợi ý để đưa tồn kho lên mức tối đa (hoặc gấp đôi mức tối thiểu nếu chưa đặt mức tối đa), bạn có thể sửa.
      Sản phẩm chưa có nhà cung cấp cần được cập nhật trước khi lập phiếu.
    </p>

    <p-dialog
      header="Xác nhận lập phiếu nhập"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '40rem' }"
    >
      <p class="mb-3 text-sm text-slate-600">
        Hệ thống sẽ tạo <b>{{ groups().length }}</b> phiếu nhập (mỗi nhà cung cấp một phiếu) ở trạng thái
        <b>Chờ duyệt</b>. Đơn giá nhập do hệ thống tự lấy từ dữ liệu sản phẩm.
      </p>

      @for (g of groups(); track g.supplierId) {
        <div class="mb-3 rounded-lg border border-slate-200 p-3">
          <div class="mb-2 font-medium text-slate-800">{{ g.supplierName }}</div>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-slate-500">
                <th class="py-1">Sản phẩm</th>
                <th class="text-right">Số lượng</th>
                <th class="text-right">Ước tính</th>
              </tr>
            </thead>
            <tbody>
              @for (l of g.lines; track l.product.MaSanPham) {
                <tr class="border-b border-slate-100">
                  <td class="py-1">{{ l.product.TenSanPham }}</td>
                  <td class="text-right">{{ l.qty }}</td>
                  <td class="text-right">
                    @if (l.cost !== null) {
                      {{ l.cost | number: '1.0-0' }} ₫
                    } @else {
                      —
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (g.total !== null) {
            <div class="mt-2 text-right text-sm">
              Tổng ước tính: <b>{{ g.total | number: '1.0-0' }} ₫</b>
            </div>
          }
        </div>
      }

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="dialogOpen.set(false)" />
        <p-button
          [label]="'Xác nhận lập ' + groups().length + ' phiếu'"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="busy()"
          (onClick)="submit()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class StockAlerts {
  private service = inject(StockService);

  readonly items = signal<AlertProduct[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string[]>([]);

  readonly selected = signal<Set<string>>(new Set());
  readonly qty = signal<Record<string, number>>({}); // chỉ lưu số lượng người dùng đã sửa
  readonly ordered = signal<Set<string>>(new Set()); // đã lập phiếu trong phiên này
  readonly dialogOpen = signal(false);

  readonly outOfStock = computed(() => this.items().filter((p) => p.SoLuongHienTai <= 0).length);

  readonly selectable = computed(() => this.items().filter((p) => this.canSelect(p)));

  readonly allSelected = computed(
    () =>
      this.selectable().length > 0 &&
      this.selectable().every((p) => this.selected().has(key(p))),
  );

  readonly selectedItems = computed(() => this.items().filter((p) => this.selected().has(key(p))));

  readonly canOrder = computed(
    () =>
      this.selectedItems().length > 0 &&
      this.selectedItems().every((p) => this.qtyOf(p) >= 1) &&
      !this.busy(),
  );

  // Gom sản phẩm đã chọn theo nhà cung cấp (mỗi nhà cung cấp một phiếu)
  readonly groups = computed<Group[]>(() => {
    const map = new Map<number, Group>();
    for (const p of this.selectedItems()) {
      const sid = Number(p.MaNhaCungCap);
      const qty = this.qtyOf(p);
      const cost = p.DonGiaNhap != null ? Number(p.DonGiaNhap) * qty : null;

      let g = map.get(sid);
      if (!g) {
        g = {
          supplierId: sid,
          supplierName: p.nha_cung_cap?.TenNhaCungCap ?? `Nhà cung cấp #${sid}`,
          lines: [],
          total: 0,
        };
        map.set(sid, g);
      }
      g.lines.push({ product: p, qty, cost });
      g.total = g.total !== null && cost !== null ? g.total + cost : null;
    }
    return [...map.values()];
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.alerts().subscribe({
      next: (data) => {
        const sorted = [...data].sort((a, b) => a.SoLuongHienTai - b.SoLuongHienTai);
        this.items.set(sorted);
        const valid = new Set(sorted.map(key));
        this.selected.update((s) => new Set([...s].filter((k) => valid.has(k))));
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách cảnh báo.');
      },
    });
  }

  isPending(p: AlertProduct) {
    return (p.SoLuongDangNhap ?? 0) > 0 || this.ordered().has(key(p));
  }

  canSelect(p: AlertProduct) {
    return p.MaNhaCungCap != null && !this.isPending(p);
  }

  isSelected(p: AlertProduct) {
    return this.selected().has(key(p));
  }

  toggle(p: AlertProduct) {
    if (!this.canSelect(p)) return;
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(key(p)) ? next.delete(key(p)) : next.add(key(p));
      return next;
    });
  }

  toggleAll() {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.selectable().map((p) => key(p))),
    );
  }

  suggested(p: AlertProduct): number {
    const current = Math.max(Number(p.SoLuongHienTai), 0);
    const target = Number(p.TonKhoToiDa);
    return Math.max(target - current);
  }

  qtyOf(p: AlertProduct): number {
    return this.qty()[key(p)] ?? this.suggested(p);
  }

  setQty(p: AlertProduct, raw: string) {
    const n = Math.floor(Number(raw));
    this.qty.update((q) => ({ ...q, [key(p)]: Number.isFinite(n) && n >= 1 ? n : 0 }));
  }

  submit() {
    const groups = this.groups();
    if (groups.length === 0) return;

    this.busy.set(true);
    this.error.set(null);
    this.success.set([]);

    forkJoin(
      groups.map((g) =>
        this.service
          .createPurchase(
            g.supplierId,
            g.lines.map((l) => ({ id: l.product.MaSanPham, qty: l.qty })),
          )
          .pipe(
            map((res) => ({ ok: true as const, group: g, id: res.data?.MaPhieuNhap })),
            catchError((e: HttpErrorResponse) =>
              of({ ok: false as const, group: g, message: this.errorText(e) }),
            ),
          ),
      ),
    ).subscribe((results) => {
      const okMessages: string[] = [];
      const failMessages: string[] = [];
      const ordered = new Set(this.ordered());
      const selected = new Set(this.selected());

      for (const r of results) {
        if (r.ok) {
          okMessages.push(`Phiếu #${r.id ?? '?'} - ${r.group.supplierName}`);
          for (const l of r.group.lines) {
            ordered.add(key(l.product));
            selected.delete(key(l.product));
          }
        } else {
          failMessages.push(`${r.group.supplierName}: ${r.message}`);
        }
      }

      this.ordered.set(ordered);
      this.selected.set(selected);
      this.success.set(okMessages);
      this.error.set(failMessages.length ? failMessages.join(' | ') : null);
      this.busy.set(false);
      this.dialogOpen.set(false);
      this.load();
    });
  }

  private errorText(e: HttpErrorResponse): string {
    const errs = e.error?.errors as Record<string, string[]> | undefined;
    if (errs) return Object.values(errs).flat().join(' ');
    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }
}
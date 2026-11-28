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
import { NoticeService } from '../../core/ui/notice.service';
import { RouterLink } from '@angular/router';

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
  imports: [TableModule, TagModule, ButtonModule, DialogModule, DecimalPipe, RouterLink],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
          <i class="pi pi-exclamation-triangle text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Cảnh báo tồn kho</h1>
          <p class="text-sm text-slate-500">Sản phẩm có số lượng thấp hơn hoặc bằng mức tồn tối thiểu</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
        <p-button
          [label]="'Lập phiếu nhập hàng (' + selectedItems().length + ')'"
          icon="pi pi-truck"
          [disabled]="!canOrder()"
          (onClick)="dialogOpen.set(true)"
        />
      </div>
    </div>

    <div class="mb-4 inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white p-1 shadow-sm">
      <span class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
        <i class="pi pi-exclamation-circle text-xs"></i>
        Sắp hết hàng
        @if (khoChuaNhap() > 0) {
          <span
            class="inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm shadow-red-500/40"
            [title]="khoLabel()"
            [attr.aria-label]="khoLabel()"
          >
            <i class="pi pi-bell text-[9px]"></i>
          </span>
        }
      </span>
      <a
        routerLink="/admin/expiry-alerts"
        class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-indigo-700"
      >
        <i class="pi pi-clock text-xs"></i>
        Sắp hết hạn
        @if (expiryMoi()) {
          <span
            class="inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm shadow-red-500/40"
            [title]="expiryLabel()"
            [attr.aria-label]="expiryLabel()"
          >
            <i class="pi pi-bell text-[9px]"></i>
          </span>
        }
      </a>
    </div>

    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <i class="pi pi-times-circle"></i>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Hết hàng</div>
          <div class="text-2xl font-semibold tabular-nums text-red-600">{{ outOfStock() }}</div>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <i class="pi pi-exclamation-circle"></i>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Sắp hết</div>
          <div class="text-2xl font-semibold tabular-nums text-amber-600">{{ items().length - outOfStock() }}</div>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <i class="pi pi-shopping-cart"></i>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Đã chọn để nhập</div>
          <div class="text-2xl font-semibold tabular-nums text-slate-800">{{ selectedItems().length }}</div>
        </div>
      </div>
    </div>

    @if (success().length) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5"></i>
        <div>
          <div class="font-medium">Đã lập phiếu nhập (đang chờ quản lý duyệt):</div>
          <ul class="ml-5 list-disc">
            @for (m of success(); track m) {
              <li>{{ m }}</li>
            }
          </ul>
        </div>
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
          <i class="pi pi-list text-indigo-500"></i>
          Danh sách sản phẩm
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{{ items().length }}</span>
        </div>
        @if (selectedItems().length > 0) {
          <span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            Đã chọn {{ selectedItems().length }} sản phẩm
          </span>
        }
      </div>

      <p-table
        [value]="items()"
        [loading]="loading()"
        dataKey="MaSanPham"
        [tableStyle]="{ 'min-width': '56rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="w-12 px-4 py-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                [checked]="allSelected()"
                [disabled]="selectable().length === 0"
                (change)="toggleAll()"
              />
            </th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sản phẩm</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nhà cung cấp</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tồn hiện tại</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tối thiểu</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Số lượng cần nhập</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr class="transition-colors hover:bg-indigo-50/40">
            <td class="px-4 py-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                [checked]="isSelected(p)"
                [disabled]="!canSelect(p)"
                (change)="toggle(p)"
              />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <i class="pi pi-box text-xs"></i>
                </div>
                <div>
                  <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
                  @if (p.TenThuongHieu) {
                    <div class="text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
                  }
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              @if (!p.nha_cung_cap) {
                <span class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <i class="pi pi-exclamation-circle text-[10px]"></i>
                  Chưa có nhà cung cấp
                </span>
              } @else {
                <div class="text-slate-700">{{ p.nha_cung_cap.TenNhaCungCap }}</div>
                @if (!supplierActive(p)) {
                  <div class="mt-0.5 text-xs text-red-600">Đã ngừng hợp tác</div>
                }
              }
            </td>
            <td class="px-4 py-3 text-right">
              <span
                class="font-semibold tabular-nums"
                [class]="p.SoLuongHienTai <= 0 ? 'text-red-600' : 'text-slate-800'"
              >{{ p.SoLuongHienTai }}</span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-500">{{ p.TonKhoToiThieu }}</td>
            <td class="px-4 py-3">
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
            <td class="px-4 py-3">
              <div class="flex justify-end">
                <input
                  type="number"
                  min="1"
                  class="w-24 rounded-lg border px-2.5 py-1.5 text-right text-sm tabular-nums outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  [class]="isSelected(p) && qtyOf(p) < 1 ? 'border-red-400 bg-red-50/40' : 'border-slate-300'"
                  [value]="qtyOf(p)"
                  [disabled]="!isSelected(p)"
                  (input)="setQty(p, $any($event.target).value)"
                />
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="px-4 py-12">
              @if (loading()) {
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-500"></i>
                  <span class="text-sm">Đang tải...</span>
                </div>
              } @else {
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <i class="pi pi-check-circle text-xl text-emerald-500"></i>
                  </div>
                  <span class="text-sm text-slate-500">Không có sản phẩm nào sắp hết hàng.</span>
                </div>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
      <i class="pi pi-info-circle mt-0.5 text-indigo-500"></i>
      <p>
        Số lượng cần nhập được gợi ý để đưa tồn kho lên mức tối đa (hoặc gấp đôi mức tối thiểu nếu chưa đặt mức tối đa), bạn có thể sửa.
        Sản phẩm chưa có nhà cung cấp cần được cập nhật trước khi lập phiếu.
      </p>
    </div>

    <p-dialog
      header="Xác nhận lập phiếu nhập"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      (keydown.enter)="onEnter($event)"
      [style]="{ width: '40rem', maxWidth: '94vw' }"
    >
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <i class="pi pi-info-circle mt-0.5"></i>
        <p>
          Hệ thống sẽ tạo <b>{{ groups().length }}</b> phiếu nhập (mỗi nhà cung cấp một phiếu) ở trạng thái
          <b>Chờ duyệt</b>. Đơn giá nhập do hệ thống tự lấy từ dữ liệu sản phẩm.
        </p>
      </div>

      @for (g of groups(); track g.supplierId) {
        <div class="mb-3 overflow-hidden rounded-xl border border-slate-200/70">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <i class="pi pi-truck text-xs text-indigo-500"></i>
              {{ g.supplierName }}
            </div>
            <span class="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {{ g.lines.length }} sản phẩm
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th class="px-4 py-2 font-semibold">Sản phẩm</th>
                <th class="px-4 py-2 text-right font-semibold">Số lượng</th>
                <th class="px-4 py-2 text-right font-semibold">Ước tính</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (l of g.lines; track l.product.MaSanPham) {
                <tr>
                  <td class="px-4 py-2 text-slate-700">{{ l.product.TenSanPham }}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-slate-800">{{ l.qty }}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-slate-700">
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
            <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-sm">
              <span class="text-slate-500">Tổng ước tính:</span>
              <b class="tabular-nums text-indigo-700">{{ g.total | number: '1.0-0' }} ₫</b>
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
  private notice = inject(NoticeService);

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

  // Chấm đỏ trên tab "Sắp hết hạn": chỉ đếm lô còn hàng sắp hết hạn (lô quá hạn đã tự động loại)
  readonly expiryTotal = computed(() => this.notice.loSapHetHan());
  // Chuông chỉ hiện khi có lô mới sắp hết hạn mà người dùng chưa mở trang xem
  readonly expiryMoi = computed(() => this.notice.moiHan());

  readonly expiryLabel = computed(() => `${this.expiryTotal()} lô hàng sắp hết hạn`);

  // Chuông tab "Sắp hết hàng": đếm sản phẩm sắp hết mà chưa có phiếu nhập nào,
  // nên mở trang xem không tắt được, chỉ khi lập phiếu nhập mới giảm về 0.
  readonly khoChuaNhap = computed(() => this.notice.canhBaoKho());
  readonly khoLabel = computed(() => `${this.khoChuaNhap()} sản phẩm sắp hết chưa có phiếu nhập`);

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
    return (
      p.MaNhaCungCap != null &&
      this.supplierActive(p) &&
      !this.isPending(p) &&
      (this.maxQty(p) ?? 1) > 0
    );
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
  // Số lượng tối đa còn được phép nhập (null = không giới hạn)
  maxQty(p: AlertProduct): number | null {
    if (!p.TonKhoToiDa) return null;
    const current = Math.max(Number(p.SoLuongHienTai), 0);
    return Math.max(Number(p.TonKhoToiDa) - current - (p.SoLuongDangNhap ?? 0), 0);
  }
  qtyOf(p: AlertProduct): number {
    return this.qty()[key(p)] ?? this.suggested(p);
  }

  setQty(p: AlertProduct, raw: string) {
    const n = Math.floor(Number(raw));
    this.qty.update((q) => ({ ...q, [key(p)]: Number.isFinite(n) && n >= 1 ? n : 0 }));
  }
  supplierActive(p: AlertProduct) {
    return Number(p.nha_cung_cap?.TrangThai ?? 1) === 1;
  }

  // Dialog chỉ đọc + nút ở footer nên Enter luôn = xác nhận lập phiếu
  onEnter(e: Event) {
    if (this.busy() || this.groups().length === 0) return;
    e.preventDefault();
    this.submit();
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
          okMessages.push(`Phiếu ${r.id ?? '?'} - ${r.group.supplierName}`);
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

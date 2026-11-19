import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';

type Filter = 'all' | 'low' | 'out';
type Severity = 'success' | 'warn' | 'danger';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-stock-update',
  imports: [ReactiveFormsModule, RouterLink, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-sliders-h text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Cập nhật tồn kho</h1>
          <p class="max-w-2xl text-sm text-slate-500">
            Kiểm kho, ghi nhận hàng hỏng, hết hạn hoặc điều chỉnh số liệu. Mọi thay đổi được lưu vào
            <a
              routerLink="/admin/stock-history"
              class="font-medium text-emerald-600 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-700"
            >lịch sử tồn kho</a>.
          </p>
        </div>
      </div>

      <div class="relative w-full sm:w-72">
        <input
          pInputText
          type="text"
          placeholder="Tìm theo tên hoặc mã sản phẩm..."
          class="w-full pl-9"
          [value]="keyword()"
          (input)="keyword.set($any($event.target).value)"
        />
      </div>
    </div>

    <div class="mb-4 inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/70 bg-white p-1 shadow-sm">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          [class]="filter() === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'"
          (click)="filter.set(t.key)"
        >
          {{ t.label }} ({{ count(t.key) }})
        </button>
      }
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
          Danh sách sản phẩm
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ filtered().length }}</span>
        </div>
      </div>

      <p-table
        [value]="filtered()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="MaSanPham"
        [tableStyle]="{ 'min-width': '50rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mã</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sản phẩm</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Loại</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tồn hiện tại</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tối thiểu / Tối đa</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                {{ p.MaSanPham }}
              </span>
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
              <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {{ p.LoaiSanPham ?? '—' }}
              </span>
            </td>
              <td class="px-4 py-3 text-right">
                <span
                    class="text-base font-semibold tabular-nums"
                    [class]="status(p).severity === 'danger' ? 'text-red-600' : 'text-slate-800'"
                  >{{ p.SoLuongHienTai }}
                </span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ p.TonKhoToiThieu ?? 0 }} / {{ p.TonKhoToiDa ?? '—' }}</td>
            <td class="px-4 py-3"><p-tag [value]="status(p).label" [severity]="status(p).severity" /></td>
            <td class="px-4 py-3">
              <div class="flex justify-end">
                <p-button label="Cập nhật" icon="pi pi-pencil" size="small" [outlined]="true" (onClick)="open(p)" />
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="px-4 py-12">
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
                  <span class="text-sm text-slate-500">Không có sản phẩm nào.</span>
                </div>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      header="Cập nhật tồn kho"
      [modal]="true"
      [visible]="!!target()"
      (visibleChange)="!$event && close()"
      [style]="{ width: '30rem', maxWidth: '94vw' }"
    >
      @if (target(); as p) {
        <form [formGroup]="form" class="space-y-4">
          @if (formError()) {
            <div class="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <i class="pi pi-exclamation-circle mt-0.5 text-sm"></i>
              <span>{{ formError() }}</span>
            </div>
          }

          <div class="rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3">
            <div class="font-semibold text-slate-800">{{ p.TenSanPham }}</div>
            <div class="mt-0.5 text-sm text-slate-600">
              Tồn hiện tại: <b class="text-slate-800">{{ p.SoLuongHienTai }}</b>
              @if (p.TonKhoToiDa) { · Tối đa: {{ p.TonKhoToiDa }} }
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
            <div class="mb-2 flex items-center justify-between gap-2">
              <label class="block text-sm font-medium text-slate-700">Số lượng mới *</label>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                (click)="form.controls.SoLuongMoi.setValue(0)"
              >
                Đặt về 0 (hết hàng)
              </button>
            </div>

            <input pInputText type="number" min="0" formControlName="SoLuongMoi" class="w-full" />

            @if (diff(p) !== 0) {
              <div
                class="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
                [class]="diff(p) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
              >
                <i [class]="diff(p) > 0 ? 'pi pi-arrow-up-right text-[10px]' : 'pi pi-arrow-down-right text-[10px]'"></i>
                Thay đổi: {{ diff(p) > 0 ? '+' : '' }}{{ diff(p) }}
              </div>
            }
            @if (overMax(p)) {
              <div class="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
                <i class="pi pi-exclamation-triangle text-[11px]"></i>
                Vượt mức tồn kho tối đa ({{ p.TonKhoToiDa }}).
              </div>
            }
          </div>

          @if (p.lo_hang?.length) {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Áp dụng cho lô</label>
              <select
                formControlName="MaLoHang"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option [ngValue]="null">Tự động (giảm lô hết hạn sớm nhất, tăng lô mới nhất)</option>
                @for (l of p.lo_hang; track l.MaLoHang) {
                  <option [ngValue]="l.MaLoHang">{{ l.MaLo }} · còn {{ l.SoLuongCon }}{{ l.HanSuDung ? ' · HSD ' + l.HanSuDung : '' }}</option>
                }
              </select>
            </div>
          }

          <div class="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
            <label class="mb-2 block text-sm font-medium text-slate-700">Lý do *</label>
            <input pInputText formControlName="LyDoCapNhat" class="w-full" list="stock-reasons" />
            <datalist id="stock-reasons">
              @for (r of reasons; track r) {
                <option [value]="r"></option>
              }
            </datalist>
          </div>
        </form>
      }

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Lưu" icon="pi pi-check" [loading]="busy()" [disabled]="cannotSave()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class StockUpdate {
  private service = inject(ProductService);
  private fb = inject(FormBuilder);

  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'low', label: 'Sắp hết' },
    { key: 'out', label: 'Hết hàng' },
  ];
  readonly reasons = ['Kiểm kho', 'Hàng hỏng', 'Hàng hết hạn', 'Thất thoát', 'Điều chỉnh số liệu'];

  readonly products = signal<Product[]>([]);
  readonly keyword = signal('');
  readonly filter = signal<Filter>('all');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly target = signal<Product | null>(null);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    SoLuongMoi: [0, [Validators.required, Validators.min(0)]],
    LyDoCapNhat: ['', [Validators.required, Validators.maxLength(255)]],
    MaLoHang: [null as number | null],
  });

  // Sản phẩm đã ẩn không cần cập nhật tồn kho
  readonly active = computed(() => this.products().filter((p) => Number(p.TrangThai ?? 1) === 1));

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    return this.active().filter(
      (p) =>
        this.matches(p, this.filter()) &&
        (!k || normalize(p.TenSanPham).includes(k) || normalize(String(p.MaSanPham)).includes(k)),
    );
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách sản phẩm.');
      },
    });
  }

  private matches(p: Product, f: Filter): boolean {
    const stock = Number(p.SoLuongHienTai);
    const min = Number(p.TonKhoToiThieu ?? 0);
    if (f === 'out') return stock <= 0;
    if (f === 'low') return stock > 0 && stock <= min;
    return true;
  }

  count(f: Filter): number {
    return this.active().filter((p) => this.matches(p, f)).length;
  }

  status(p: Product): { label: string; severity: Severity } {
    const stock = Number(p.SoLuongHienTai);
    if (stock <= 0) return { label: 'Hết hàng', severity: 'danger' };
    if (stock <= Number(p.TonKhoToiThieu ?? 0)) return { label: 'Sắp hết', severity: 'warn' };
    return { label: 'Còn hàng', severity: 'success' };
  }

  open(p: Product) {
    this.target.set(p);
    this.formError.set(null);
    this.form.reset({ SoLuongMoi: Number(p.SoLuongHienTai), LyDoCapNhat: '', MaLoHang: null });
  }

  close() {
    if (!this.busy()) this.target.set(null);
  }

  private newQty(): number {
    return Math.floor(Number(this.form.controls.SoLuongMoi.value));
  }

  diff(p: Product): number {
    const n = this.newQty();
    return Number.isFinite(n) ? n - Number(p.SoLuongHienTai) : 0;
  }

  overMax(p: Product): boolean {
    const max = Number(p.TonKhoToiDa ?? 0);
    return max > 0 && this.newQty() > max;
  }

  cannotSave(): boolean {
    const p = this.target();
    return !p || this.form.invalid || this.busy() || this.overMax(p);
  }


  save() {
    const p = this.target();
    if (!p || this.cannotSave()) return;

    const moi = this.newQty();
    const cu = Number(p.SoLuongHienTai);

    if (moi === cu) {
      this.formError.set('Số lượng mới đang bằng số lượng hiện tại.');
      return;
    }

    this.busy.set(true);
    this.formError.set(null);

    this.service.updateStock(
      p.MaSanPham,
      moi,
      this.form.controls.LyDoCapNhat.value.trim(),
      this.form.controls.MaLoHang.value
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.target.set(null);

        const canhBao = moi <= Number(p.TonKhoToiThieu ?? 0);

        this.notify(
          `Đã cập nhật "${p.TenSanPham}": ${cu} → ${moi}.` +
          (canhBao ? ' Sản phẩm này hiện nằm trong mục Cảnh báo kho.' : ''),
        );

        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);

        const errs = e.error?.errors as Record<string, string[]> | undefined;

        this.formError.set(
          errs
            ? Object.values(errs).flat().join(' ')
            : (e.error?.message ?? 'Cập nhật tồn kho thất bại.'),
        );
      },
    });
  }

  private notify(message: string) {
    this.success.set(message);
    this.error.set(null);
    setTimeout(() => this.success.set(null), 5000);
  }
}
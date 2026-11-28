import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { plainEnter } from '../../core/ui/enter';

type Filter = 'all' | 'low' | 'out';
type Severity = 'success' | 'warn' | 'danger';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');

const OTHER = 'Khác';
const categoryOf = (p: Product) => p.LoaiSanPham?.trim() || OTHER;

@Component({
  selector: 'app-stock-update',
  imports: [ReactiveFormsModule, RouterLink, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, TooltipModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
          <i class="pi pi-sliders-h text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Cập nhật tồn kho</h1>
          <p class="max-w-2xl text-sm text-slate-500">
            Kiểm kho, ghi nhận hàng hỏng, hết hạn hoặc thất thoát. Chỉ được giảm số lượng và mọi lần giảm đều được
            ghi nhận là hao hụt. Lịch sử đầy đủ ở
            <a
              routerLink="/admin/stock-history"
              class="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700"
            >lịch sử tồn kho</a>.
          </p>
        </div>
      </div>

      <div class="relative w-full sm:w-72">
        <input
          pInputText
          type="text"
          placeholder="Tìm theo tên sản phẩm..."
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
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          [class]="filter() === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-700'"
          (click)="filter.set(t.key)"
        >
          {{ t.label }} ({{ count(t.key) }})
        </button>
      }
    </div>

    <!-- Lọc theo danh mục -->
    @if (categoryChips().length > 1) {
      <div class="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <span class="shrink-0 self-center pr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Danh mục</span>
        <button
          type="button"
          class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
          [class]="category() === null
            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700'"
          (click)="onCategory(null)"
        >
          Tất cả ({{ base().length }})
        </button>
        @for (c of categoryChips(); track c.name) {
          <button
            type="button"
            class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
            [class]="category() === c.name
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700'"
            (click)="onCategory(c.name)"
          >
            {{ c.name }} ({{ c.count }})
          </button>
        }
      </div>
    }

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
          <i class="pi pi-list text-indigo-500"></i>
          Danh sách sản phẩm
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{{ filtered().length }}</span>
        </div>
      </div>

      <p-table
        [value]="filtered()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="MaSanPham"
        [tableStyle]="{ 'min-width': '46rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sản phẩm</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Loại</th>
            <th class="px-4 py-3 text-center! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tồn hiện tại</th>
            <th class="px-4 py-3 text-center! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tối thiểu / Tối đa</th>
            <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr class="transition-colors hover:bg-indigo-100/60!">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60">
                  @if (p.hinh_anh_url) {
                    <img [src]="p.hinh_anh_url" alt="" class="h-full w-full object-cover" />
                  } @else {
                    <i class="pi pi-image text-slate-300"></i>
                  }
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-800">{{ p.TenSanPham }}</div>
                  @if (p.TenThuongHieu) {
                    <div class="truncate text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
                  }
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {{ p.LoaiSanPham ?? '—' }}
              </span>
            </td>
            <td class="px-4 py-3 text-center!">
              <span
                class="text-base font-semibold tabular-nums"
                [class]="status(p).severity === 'danger' ? 'text-red-600' : 'text-slate-800'"
              >{{ p.SoLuongHienTai }}</span>
            </td>
            <td class="px-4 py-3 text-center! tabular-nums text-slate-600">{{ p.TonKhoToiThieu ?? 0 }} / {{ p.TonKhoToiDa ?? '—' }}</td>
            <td class="px-4 py-3"><p-tag [value]="status(p).label" [severity]="status(p).severity" /></td>
            <td class="px-4 py-3">
              <div class="flex justify-end">
                <p-button
                  icon="pi pi-pencil"
                  ariaLabel="Cập nhật tồn kho"
                  pTooltip="Cập nhật tồn kho"
                  tooltipPosition="top"
                  size="small"
                  [text]="true"
                  [rounded]="true"
                  (onClick)="open(p)"
                />
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="px-4 py-12">
              @if (loading()) {
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <i class="pi pi-spin pi-spinner text-2xl text-indigo-500"></i>
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
      (keydown.enter)="onEnter($event)"
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

          <div class="rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-4 py-3">
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

            <input pInputText type="number" min="0" [attr.max]="p.SoLuongHienTai" formControlName="SoLuongMoi" class="w-full" />

            @if (diff(p) > 0) {
              <div class="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                <i class="pi pi-lock text-[11px]"></i>
                Không thể tăng tồn kho — chỉ được phép giảm.
              </div>
            } @else if (diff(p) < 0) {
              <div class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <i class="pi pi-arrow-down-right text-[10px]"></i>
                Giảm {{ -diff(p) }} · sẽ ghi nhận hao hụt
              </div>
            }
          </div>

          @if (p.lo_hang?.length) {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Áp dụng cho lô</label>
              <select
                formControlName="MaLoHang"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option [ngValue]="null">Tự động (giảm lô nhập trước nhất)</option>
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
  readonly category = signal<string | null>(null);
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

  // Đã lọc theo từ khóa và trạng thái, chưa lọc theo danh mục (để đếm số lượng mỗi danh mục)
  readonly base = computed(() => {
    const words = normalize(this.keyword().trim()).split(/\s+/).filter(Boolean);
    const f = this.filter();
    return this.active().filter((p) => this.matches(p, f) && this.khopTen(p, words));
  });

  readonly categoryChips = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.active()) counts.set(categoryOf(p), 0);
    for (const p of this.base()) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1);

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name.localeCompare(b.name, 'vi'),
      );
  });

  readonly filtered = computed(() => {
    const cat = this.category();
    return this.base().filter((p) => !cat || categoryOf(p) === cat);
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

  // Khớp đầu từ trong tên sản phẩm (gõ "u" vẫn ra "Đồ uống"); bỏ dấu, không phân biệt hoa/thường
  private khopTen(p: Product, words: string[]): boolean {
    if (words.length === 0) return true;
    const ten = normalize(p.TenSanPham ?? '')
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    return words.every((w) => ten.some((t) => t.startsWith(w)));
  }

  onCategory(name: string | null) {
    this.category.set(name);
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

  // Chỉ được giảm: số lượng mới phải nhỏ hơn tồn hiện tại
  cannotSave(): boolean {
    const p = this.target();
    return !p || this.form.invalid || this.busy() || this.diff(p) >= 0;
  }


  onEnter(e: Event) {
    if (!plainEnter(e) || this.cannotSave()) return;
    e.preventDefault();
    this.save();
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
    if (moi > cu) {
      this.formError.set('Chỉ được phép giảm số lượng tồn kho.');
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
          `Đã cập nhật "${p.TenSanPham}": ${cu} → ${moi}, ghi nhận hao hụt ${cu - moi}.` +
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
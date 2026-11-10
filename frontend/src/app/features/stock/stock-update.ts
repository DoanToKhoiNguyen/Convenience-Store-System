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
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Cập nhật tồn kho</h1>
        <p class="text-sm text-slate-500">
          Kiểm kho, ghi nhận hàng hỏng, hết hạn hoặc điều chỉnh số liệu. Mọi thay đổi được lưu vào
          <a routerLink="/admin/stock-history" class="text-emerald-600 underline">lịch sử tồn kho</a>.
        </p>
      </div>

      <input
        pInputText
        type="text"
        placeholder="Tìm theo tên hoặc mã sản phẩm..."
        class="w-72"
        [value]="keyword()"
        (input)="keyword.set($any($event.target).value)"
      />
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium"
          [class]="filter() === t.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          (click)="filter.set(t.key)"
        >
          {{ t.label }} ({{ count(t.key) }})
        </button>
      }
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="rounded-xl bg-white p-2 shadow-sm">
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
          <tr>
            <th>Mã</th>
            <th>Sản phẩm</th>
            <th>Loại</th>
            <th class="text-right">Tồn hiện tại</th>
            <th class="text-right">Tối thiểu / Tối đa</th>
            <th>Trạng thái</th>
            <th class="text-right">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr>
            <td>{{ p.MaSanPham }}</td>
            <td>
              <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
              @if (p.TenThuongHieu) {
                <div class="text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
              }
            </td>
            <td>{{ p.LoaiSanPham ?? '—' }}</td>
            <td class="text-right text-base font-semibold text-slate-800">{{ p.SoLuongHienTai }}</td>
            <td class="text-right text-slate-600">{{ p.TonKhoToiThieu ?? 0 }} / {{ p.TonKhoToiDa ?? '—' }}</td>
            <td><p-tag [value]="status(p).label" [severity]="status(p).severity" /></td>
            <td class="text-right">
              <p-button label="Cập nhật" icon="pi pi-pencil" size="small" [outlined]="true" (onClick)="open(p)" />
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-500">Không có sản phẩm nào.</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      header="Cập nhật tồn kho"
      [modal]="true"
      [visible]="!!target()"
      (visibleChange)="!$event && close()"
      [style]="{ width: '26rem' }"
    >
      @if (target(); as p) {
        <form [formGroup]="form" class="space-y-3">
          @if (formError()) {
            <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
          }

          <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
            <div class="text-slate-600">
              Tồn hiện tại: <b>{{ p.SoLuongHienTai }}</b>
              @if (p.TonKhoToiDa) { · Tối đa: {{ p.TonKhoToiDa }} }
            </div>
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="block text-sm font-medium text-slate-700">Số lượng mới *</label>
              <button type="button" class="text-xs text-red-600 underline" (click)="form.controls.SoLuongMoi.setValue(0)">
                Đặt về 0 (hết hàng)
              </button>
            </div>
            <input pInputText type="number" min="0" formControlName="SoLuongMoi" class="w-full" />
            @if (diff(p) !== 0) {
              <small [class]="diff(p) > 0 ? 'text-emerald-600' : 'text-red-600'">
                Thay đổi: {{ diff(p) > 0 ? '+' : '' }}{{ diff(p) }}
              </small>
            }
            @if (overMax(p)) {
              <small class="block text-red-600">Vượt mức tồn kho tối đa ({{ p.TonKhoToiDa }}).</small>
            }
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Lý do *</label>
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
        this.form.reset({ SoLuongMoi: Number(p.SoLuongHienTai), LyDoCapNhat: '' });
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
        this.service.updateStock(p.MaSanPham, moi, this.form.controls.LyDoCapNhat.value.trim()).subscribe({
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
                    errs ? Object.values(errs).flat().join(' ') : (e.error?.message ?? 'Cập nhật tồn kho thất bại.'),
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
import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { Product, ProductPayload, Supplier } from './product.model';
import { ProductService } from './product.service';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const num = (v: number | null | undefined) => (v == null ? null : Number(v));
const text = (v: string | null | undefined) => (v ?? '').trim() || null;

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, DecimalPipe],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Sản phẩm</h1>
        <p class="text-sm text-slate-500">{{ filtered().length }} / {{ products().length }} sản phẩm</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          pInputText
          type="text"
          placeholder="Tìm theo tên hoặc mã sản phẩm..."
          class="w-72"
          [value]="keyword()"
          (input)="keyword.set($any($event.target).value)"
        />
        @if (canEdit()) {
          <p-button label="Thêm sản phẩm" icon="pi pi-plus" (onClick)="openCreate()" />
        }
      </div>
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
            <th>Tên sản phẩm</th>
            <th>Loại</th>
            @if (canEdit()) {
              <th class="text-right">Giá nhập</th>
            }
            <th class="text-right">Giá bán</th>
            <th class="text-right">Tồn kho</th>
            <th>Trạng thái</th>
            @if (canEdit()) {
              <th class="text-right">Thao tác</th>
            }
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
            @if (canEdit()) {
              <td class="text-right">{{ p.DonGiaNhap | number: '1.0-0' }} ₫</td>
            }
            <td class="text-right">{{ p.DonGiaBan | number: '1.0-0' }} ₫</td>
            <td class="text-right">{{ p.SoLuongHienTai }}</td>
            <td><p-tag [value]="stock(p).label" [severity]="stock(p).severity" /></td>
            @if (canEdit()) {
              <td class="text-right">
  <div class="flex justify-end gap-1">
    <p-button label="Sửa" size="small" [text]="true" (onClick)="openEdit(p)" />
    @if (isHidden(p)) {
      <p-button label="Hiện lại" size="small" severity="success" [text]="true" [disabled]="busy()" (onClick)="restore(p)" />
    } @else {
      <p-button label="Xóa" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="remove(p)" />
    }
  </div>
</td>
            }
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="8" class="py-8 text-center text-slate-500">Không có sản phẩm nào.</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa sản phẩm' : 'Thêm sản phẩm'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '42rem' }"
    >
      <form [formGroup]="form" class="space-y-3">
        @if (formError()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
          <input pInputText formControlName="TenSanPham" class="w-full" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Loại sản phẩm</label>
            <input pInputText formControlName="LoaiSanPham" class="w-full" list="product-categories" />
            <datalist id="product-categories">
              @for (c of categories(); track c) {
                <option [value]="c"></option>
              }
            </datalist>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Thương hiệu</label>
            <input pInputText formControlName="TenThuongHieu" class="w-full" />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Nhà cung cấp *</label>
          <select formControlName="MaNhaCungCap" class="w-full rounded-md border border-slate-300 px-3 py-2">
            <option [ngValue]="null" disabled>-- Chọn nhà cung cấp --</option>
            @for (s of supplierOptions(); track s.MaNhaCungCap) {
              <option [ngValue]="s.MaNhaCungCap">{{ s.TenNhaCungCap }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Giá nhập (₫) *</label>
            <input pInputText type="number" min="0" formControlName="DonGiaNhap" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Giá bán (₫) *</label>
            <input pInputText type="number" min="0" formControlName="DonGiaBan" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Tồn tối thiểu *</label>
            <input pInputText type="number" min="0" formControlName="TonKhoToiThieu" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Tồn tối đa</label>
            <input pInputText type="number" min="0" formControlName="TonKhoToiDa" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Cảnh báo HSD (ngày)</label>
            <input pInputText type="number" min="0" formControlName="CanhBaoHSD" class="w-full" />
          </div>
        </div>
        @if (form.hasError('maxLtMin')) {
          <small class="text-red-600">Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.</small>
        }

        @if (editing(); as e) {
          <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Tồn kho hiện tại: <b>{{ e.SoLuongHienTai }}</b>. Muốn đổi số lượng, dùng chức năng cập nhật tồn kho để có lịch sử.
          </div>
        } @else {
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Số lượng ban đầu</label>
            <input pInputText type="number" min="0" formControlName="SoLuongHienTai" class="w-full" />
          </div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea formControlName="MoTa" rows="2" class="w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Thành phần</label>
          <textarea formControlName="ThanhPhan" rows="2" class="w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="dialogOpen.set(false)" />
        <p-button
          label="Lưu"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="form.invalid || busy()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductList {
  private service = inject(ProductService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly keyword = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly formError = signal<string | null>(null);

  // Chỉ chủ và quản lý được thêm / sửa (khớp route role:1,2 ở backend)
  readonly canEdit = computed(() => this.auth.hasAnyRole([ROLE.OWNER, ROLE.MANAGER]));

  readonly categories = computed(() => [
    ...new Set(this.products().map((p) => p.LoaiSanPham).filter((c): c is string => !!c)),
  ]);

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    if (!k) return this.products();
    return this.products().filter(
      (p) => normalize(p.TenSanPham).includes(k) || normalize(String(p.MaSanPham)).includes(k),
    );
  });

  readonly form = this.fb.group(
    {
      TenSanPham: ['', Validators.required],
      LoaiSanPham: [''],
      TenThuongHieu: [''],
      MaNhaCungCap: [null as number | null, Validators.required],
      DonGiaNhap: [null as number | null, [Validators.required, Validators.min(0)]],
      DonGiaBan: [null as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiThieu: [0 as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiDa: [null as number | null],
      CanhBaoHSD: [null as number | null],
      SoLuongHienTai: [0 as number | null, Validators.min(0)],
      MoTa: [''],
      ThanhPhan: [''],
    },
    {
      validators: (g) => {
        const min = g.get('TonKhoToiThieu')?.value;
        const max = g.get('TonKhoToiDa')?.value;
        return max != null && min != null && Number(max) < Number(min) ? { maxLtMin: true } : null;
      },
    },
  );
  readonly supplierOptions = computed(() => {
    const current = Number(this.editing()?.MaNhaCungCap ?? 0);
    return this.suppliers().filter(
      (s) => Number(s.TrangThai ?? 1) === 1 || s.MaNhaCungCap === current,
    );
  });
  constructor() {
    this.load();
    if (this.canEdit()) {
      this.service.suppliers().subscribe({
        next: (s) => this.suppliers.set(s ?? []),
        error: () => this.error.set('Không tải được danh sách nhà cung cấp.'),
      });
    }
  }

  load() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  isHidden(p: Product) {
    return Number(p.TrangThai ?? 1) === 0;
  }
  stock(p: Product): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
    if (this.isHidden(p)) return { label: 'Đã ẩn', severity: 'secondary' };
    if (p.SoLuongHienTai <= 0) return { label: 'Hết hàng', severity: 'danger' };
    if (p.SoLuongHienTai <= p.TonKhoToiThieu) return { label: 'Sắp hết', severity: 'warn' };
    return { label: 'Còn hàng', severity: 'success' };
  }

  remove(p: Product) {
    if (
      !confirm(
        `Xóa sản phẩm "${p.TenSanPham}"?\nNếu sản phẩm đã có trong hóa đơn hoặc phiếu nhập, hệ thống chỉ ẩn nó.`,
      )
    )
      return;

    this.busy.set(true);
    this.service.remove(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }

  restore(p: Product) {
    this.busy.set(true);
    this.service.restore(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }
  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      TenSanPham: '', LoaiSanPham: '', TenThuongHieu: '', MaNhaCungCap: null,
      DonGiaNhap: null, DonGiaBan: null, TonKhoToiThieu: 0, TonKhoToiDa: null,
      CanhBaoHSD: null, SoLuongHienTai: 0, MoTa: '', ThanhPhan: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(p: Product) {
    this.editing.set(p);
    this.formError.set(null);
    this.form.reset({
      TenSanPham: p.TenSanPham,
      LoaiSanPham: p.LoaiSanPham ?? '',
      TenThuongHieu: p.TenThuongHieu ?? '',
      MaNhaCungCap: p.MaNhaCungCap != null ? Number(p.MaNhaCungCap) : null,
      DonGiaNhap: num(p.DonGiaNhap as number | null),
      DonGiaBan: num(p.DonGiaBan as number),
      TonKhoToiThieu: p.TonKhoToiThieu,
      TonKhoToiDa: p.TonKhoToiDa ?? null,
      CanhBaoHSD: p.CanhBaoHSD ?? null,
      SoLuongHienTai: p.SoLuongHienTai,
      MoTa: p.MoTa ?? '',
      ThanhPhan: p.ThanhPhan ?? '',
    });
    this.dialogOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const body: ProductPayload = {
      TenSanPham: (v.TenSanPham ?? '').trim(),
      LoaiSanPham: text(v.LoaiSanPham),
      TenThuongHieu: text(v.TenThuongHieu),
      MaNhaCungCap: Number(v.MaNhaCungCap),
      DonGiaNhap: Number(v.DonGiaNhap),
      DonGiaBan: Number(v.DonGiaBan),
      TonKhoToiThieu: Number(v.TonKhoToiThieu ?? 0),
      TonKhoToiDa: num(v.TonKhoToiDa),
      CanhBaoHSD: num(v.CanhBaoHSD),
      MoTa: text(v.MoTa),
      ThanhPhan: text(v.ThanhPhan),
    };

    const current = this.editing();
    if (!current) body.SoLuongHienTai = Number(v.SoLuongHienTai ?? 0);

    const request = current
      ? this.service.update(current.MaSanPham, body)
      : this.service.create(body);

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.notify(current ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  private notify(message: string) {
    this.success.set(message);
    this.error.set(null);
    setTimeout(() => this.success.set(null), 4000);
  }

  private errorText(e: HttpErrorResponse): string {
    const errs = e.error?.errors as Record<string, string[]> | undefined;
    if (errs) return Object.values(errs).flat().join(' ');
    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }

}
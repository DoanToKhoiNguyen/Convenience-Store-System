import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ConfirmService } from '../../core/ui/confirm.service';
import { Category } from '../categories/category.model';
import { CategoryService } from '../categories/category.service';
import { SupplierItem } from './supplier.model';
import { SupplierService } from './supplier.service';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-supplier-list',
  imports: [ReactiveFormsModule, RouterLink, TableModule, ButtonModule, DialogModule, InputTextModule, TagModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Nhà cung cấp</h1>
        <p class="text-sm text-slate-500">{{ filtered().length }} / {{ suppliers().length }} nhà cung cấp</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          pInputText
          type="text"
          placeholder="Tìm theo tên, địa chỉ, số điện thoại, danh mục..."
          class="w-80"
          [value]="keyword()"
          (input)="keyword.set($any($event.target).value)"
        />
        <p-button label="Thêm nhà cung cấp" icon="pi pi-plus" (onClick)="openCreate()" />
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
        dataKey="MaNhaCungCap"
        [tableStyle]="{ 'min-width': '56rem' }"
      >
        <ng-template #header>
          <tr>
            <th>Mã</th>
            <th>Tên nhà cung cấp</th>
            <th>Danh mục cung cấp</th>
            <th>Địa chỉ</th>
            <th>Số điện thoại</th>
            <th>Trạng thái</th>
            <th class="text-right">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-s>
          <tr>
            <td>{{ s.MaNhaCungCap }}</td>
            <td class="font-medium text-slate-800">{{ s.TenNhaCungCap }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                @for (c of s.danh_muc ?? []; track c.MaDanhMuc) {
                  <span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    {{ c.TenDanhMuc }}
                  </span>
                } @empty {
                  <span class="text-xs text-slate-400">—</span>
                }
              </div>
            </td>
            <td>{{ s.DiaChi }}</td>
            <td>{{ s.SoDienThoai }}</td>
            <td>
              <p-tag
                [value]="isHidden(s) ? 'Ngừng hợp tác' : 'Đang hợp tác'"
                [severity]="isHidden(s) ? 'secondary' : 'success'"
              />
            </td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <p-button label="Sửa" size="small" [text]="true" (onClick)="openEdit(s)" />
                @if (isHidden(s)) {
                  <p-button label="Hợp tác lại" size="small" severity="success" [text]="true" [disabled]="busy()" (onClick)="restore(s)" />
                } @else {
                  <p-button label="Xóa" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="remove(s)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr><td colspan="7" class="py-8 text-center text-slate-500">Chưa có nhà cung cấp nào.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '34rem' }"
    >
      <form [formGroup]="form" class="space-y-3">
        @if (formError()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Tên nhà cung cấp *</label>
          <input pInputText formControlName="TenNhaCungCap" class="w-full" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Địa chỉ *</label>
          <input pInputText formControlName="DiaChi" class="w-full" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Số điện thoại *</label>
          <input pInputText formControlName="SoDienThoai" class="w-full" />
          @if (form.controls.SoDienThoai.touched && form.controls.SoDienThoai.hasError('pattern')) {
            <small class="text-red-600">Số điện thoại không hợp lệ.</small>
          }
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Cung cấp cho danh mục *</label>

          @if (categories().length === 0) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chưa có danh mục nào. Hãy tạo danh mục ở trang
              <a routerLink="/admin/categories" class="underline">Danh mục</a> trước.
            </p>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (c of categories(); track c.MaDanhMuc) {
                <button
                  type="button"
                  role="checkbox"
                  [attr.aria-checked]="isPicked(c.MaDanhMuc)"
                  class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
                  [class]="isPicked(c.MaDanhMuc)
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'"
                  (click)="togglePick(c.MaDanhMuc)"
                >
                  <i [class]="isPicked(c.MaDanhMuc) ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                  {{ c.TenDanhMuc }}
                </button>
              }
            </div>
            @if (picked().length === 0) {
              <small class="text-red-600">Chọn ít nhất một danh mục.</small>
            }
          }
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="dialogOpen.set(false)" />
        <p-button
          label="Lưu"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="form.invalid || picked().length === 0 || busy()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class SupplierList {
  private service = inject(SupplierService);
  private categoryService = inject(CategoryService);
  private confirmDialog = inject(ConfirmService);
  private fb = inject(FormBuilder);

  readonly suppliers = signal<SupplierItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly keyword = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<SupplierItem | null>(null);
  readonly formError = signal<string | null>(null);
  readonly picked = signal<number[]>([]);

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    if (!k) return this.suppliers();
    return this.suppliers().filter((s) =>
      normalize(
        `${s.TenNhaCungCap} ${s.DiaChi} ${s.SoDienThoai} ${(s.danh_muc ?? []).map((c) => c.TenDanhMuc).join(' ')}`,
      ).includes(k),
    );
  });

  readonly form = this.fb.nonNullable.group({
    TenNhaCungCap: ['', [Validators.required, Validators.maxLength(255)]],
    DiaChi: ['', [Validators.required, Validators.maxLength(255)]],
    SoDienThoai: ['', [Validators.required, Validators.pattern(/^[0-9+\s().-]{8,20}$/)]],
  });

  constructor() {
    this.load();
    this.categoryService.list().subscribe({
      next: (c) => this.categories.set(c ?? []),
      error: () => this.error.set('Không tải được danh sách danh mục.'),
    });
  }

  load() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách nhà cung cấp.');
      },
    });
  }

  isHidden(s: SupplierItem) {
    return Number(s.TrangThai ?? 1) === 0;
  }

  isPicked(id: number) {
    return this.picked().includes(id);
  }

  togglePick(id: number) {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.picked.set([]);
    this.form.reset({ TenNhaCungCap: '', DiaChi: '', SoDienThoai: '' });
    this.dialogOpen.set(true);
  }

  openEdit(s: SupplierItem) {
    this.editing.set(s);
    this.formError.set(null);
    this.picked.set((s.danh_muc ?? []).map((c) => Number(c.MaDanhMuc)));
    this.form.reset({
      TenNhaCungCap: s.TenNhaCungCap,
      DiaChi: s.DiaChi,
      SoDienThoai: s.SoDienThoai,
    });
    this.dialogOpen.set(true);
  }

  save() {
    if (this.form.invalid || this.picked().length === 0) return;

    const v = this.form.getRawValue();
    const body = {
      TenNhaCungCap: v.TenNhaCungCap.trim(),
      DiaChi: v.DiaChi.trim(),
      SoDienThoai: v.SoDienThoai.trim(),
      DanhMuc: this.picked(),
    };

    const current = this.editing();
    const request = current
      ? this.service.update(current.MaNhaCungCap, body)
      : this.service.create(body);

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.notify(current ? 'Đã cập nhật nhà cung cấp.' : 'Đã thêm nhà cung cấp.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  async remove(s: SupplierItem) {
    const ok = await this.confirmDialog.ask({
      title: 'Xóa nhà cung cấp',
      message:
        `Bạn có chắc muốn xóa "${s.TenNhaCungCap}"?\n` +
        'Nếu đã có sản phẩm hoặc phiếu nhập, hệ thống chỉ chuyển sang "Ngừng hợp tác".',
      confirmLabel: 'Xóa nhà cung cấp',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.service.remove(s.MaNhaCungCap).subscribe({
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

  restore(s: SupplierItem) {
    this.busy.set(true);
    this.service.restore(s.MaNhaCungCap).subscribe({
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
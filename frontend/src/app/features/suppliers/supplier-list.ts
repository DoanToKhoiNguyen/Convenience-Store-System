import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ConfirmService } from '../../core/ui/confirm.service';
import { plainEnter } from '../../core/ui/enter';
import { Category } from '../categories/category.model';
import { CategoryService } from '../categories/category.service';
import { SupplierItem } from './supplier.model';
import { SupplierService } from './supplier.service';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-supplier-list',
  imports: [ReactiveFormsModule, RouterLink, TableModule, ButtonModule, DialogModule, InputTextModule, TagModule, TooltipModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-building text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Nhà cung cấp</h1>
          <p class="text-sm text-slate-500">{{ filtered().length }} / {{ suppliers().length }} nhà cung cấp</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="w-full sm:w-80">
          <input
            pInputText
            type="text"
            placeholder="Tìm theo tên, địa chỉ, số điện thoại, danh mục..."
            class="w-full"
            [value]="keyword()"
            (input)="keyword.set($any($event.target).value)"
          />
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98]"
          (click)="openCreate()"
        >
          <i class="pi pi-plus text-xs"></i>
          Thêm nhà cung cấp
        </button>
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

    @if (catChips().length > 0) {
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="mr-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <i class="pi pi-filter text-[11px]"></i>
          Lọc danh mục
        </span>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
          [class]="categoryFilter() === null
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'"
          (click)="categoryFilter.set(null)"
        >
          Tất cả
          <span
            class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
            [class]="categoryFilter() === null ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ suppliers().length }}
          </span>
        </button>
        @for (c of catChips(); track c.MaDanhMuc) {
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
            [class]="categoryFilter() === c.MaDanhMuc
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'"
            (click)="toggleCategory(c.MaDanhMuc)"
          >
            {{ c.TenDanhMuc }}
            <span
              class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
              [class]="categoryFilter() === c.MaDanhMuc ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ c.count }}
            </span>
          </button>
        }
      </div>
    }

    <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <i class="pi pi-list text-emerald-500"></i>
          Danh sách nhà cung cấp
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ filtered().length }}</span>
        </div>
        @if (categoryFilter() !== null) {
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            (click)="categoryFilter.set(null)"
          >
            <i class="pi pi-times text-[10px]"></i>
            Bỏ lọc danh mục
          </button>
        }
      </div>

      <p-table
        [value]="filtered()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        dataKey="MaNhaCungCap"
        [tableStyle]="{ 'min-width': '64rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="min-w-[15rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tên nhà cung cấp</th>
            <th class="min-w-[13rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Danh mục cung cấp</th>
            <th class="min-w-[16rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Địa chỉ</th>
            <th class="min-w-[10rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Số điện thoại</th>
            <th class="min-w-[9rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            <th class="w-28 px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-s>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td class="whitespace-normal! px-4 py-3">
              <div class="flex items-start gap-2.5">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <i class="pi pi-building text-xs"></i>
                </div>
                <span class="font-medium text-slate-800">{{ s.TenNhaCungCap }}</span>
              </div>
            </td>
            <td class="whitespace-normal! px-4 py-3">
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
            <td class="whitespace-normal! px-4 py-3">
              <div class="flex items-start gap-1.5 text-slate-600">
                <i class="pi pi-map-marker mt-0.5 shrink-0 text-[11px] text-slate-400"></i>
                <span>{{ s.DiaChi }}</span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <div class="flex items-center gap-1.5 tabular-nums text-slate-600">
                <i class="pi pi-phone shrink-0 text-[11px] text-slate-400"></i>
                <span>{{ s.SoDienThoai }}</span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <p-tag
                [value]="isHidden(s) ? 'Ngừng hợp tác' : 'Đang hợp tác'"
                [severity]="isHidden(s) ? 'secondary' : 'success'"
              />
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-1">
                <p-button
                  icon="pi pi-pencil"
                  size="small"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Sửa nhà cung cấp"
                  pTooltip="Sửa"
                  tooltipPosition="top"
                  (onClick)="openEdit(s)"
                />
                @if (isHidden(s)) {
                  <p-button
                    icon="pi pi-replay"
                    size="small"
                    severity="success"
                    [text]="true"
                    [rounded]="true"
                    [disabled]="busy()"
                    ariaLabel="Hợp tác lại"
                    pTooltip="Hợp tác lại"
                    tooltipPosition="top"
                    (onClick)="restore(s)"
                  />
                } @else {
                  <p-button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    [disabled]="busy()"
                    ariaLabel="Xóa nhà cung cấp"
                    pTooltip="Xóa"
                    tooltipPosition="top"
                    (onClick)="remove(s)"
                  />
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
                    {{ suppliers().length > 0 ? 'Không có nhà cung cấp phù hợp bộ lọc.' : 'Chưa có nhà cung cấp nào.' }}
                  </span>
                </div>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      (keydown.enter)="onEnter($event)"
      [style]="{ width: '34rem', maxWidth: '94vw' }"
    >
      <form [formGroup]="form" class="space-y-4">
        @if (formError()) {
          <div class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <!-- Thông tin nhà cung cấp -->
        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-building text-emerald-500"></i>
            Thông tin nhà cung cấp
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên nhà cung cấp <span class="text-red-500">*</span>
            </label>
            <input
              pInputText
              formControlName="TenNhaCungCap"
              class="w-full"
              placeholder="Ví dụ: Công ty TNHH Thực phẩm ABC"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Địa chỉ <span class="text-red-500">*</span>
            </label>
            <input
              pInputText
              formControlName="DiaChi"
              class="w-full"
              placeholder="Số nhà, đường, phường/xã, quận/huyện"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Số điện thoại <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <i class="pi pi-phone pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
              <input
                pInputText
                formControlName="SoDienThoai"
                class="w-full pl-9!"
                placeholder="Ví dụ: 0901 234 567"
              />
            </div>
            @if (form.controls.SoDienThoai.touched && form.controls.SoDienThoai.hasError('pattern')) {
              <small class="mt-1 flex items-center gap-1.5 text-red-600">
                <i class="pi pi-exclamation-circle text-xs"></i>
                Số điện thoại không hợp lệ.
              </small>
            }
          </div>
        </div>

        <!-- Danh mục cung cấp -->
        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <i class="pi pi-tags text-emerald-500"></i>
              Danh mục cung cấp <span class="text-red-500">*</span>
            </div>
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-medium transition"
              [class]="picked().length > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'"
            >
              {{ picked().length }} đã chọn
            </span>
          </div>

          @if (categories().length === 0) {
            <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <i class="pi pi-exclamation-triangle mt-0.5 text-[11px] text-amber-500"></i>
              <span>
                Chưa có danh mục nào. Hãy tạo danh mục ở trang
                <a routerLink="/admin/categories" class="font-medium underline">Danh mục</a> trước.
              </span>
            </div>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (c of categories(); track c.MaDanhMuc) {
                <button
                  type="button"
                  role="checkbox"
                  [attr.aria-checked]="isPicked(c.MaDanhMuc)"
                  class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition"
                  [class]="isPicked(c.MaDanhMuc)
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'"
                  (click)="togglePick(c.MaDanhMuc)"
                >
                  <i [class]="isPicked(c.MaDanhMuc) ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                  {{ c.TenDanhMuc }}
                </button>
              }
            </div>
            @if (picked().length === 0) {
              <small class="flex items-center gap-1.5 text-red-600">
                <i class="pi pi-exclamation-circle text-xs"></i>
                Chọn ít nhất một danh mục.
              </small>
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
  readonly categoryFilter = signal<number | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<SupplierItem | null>(null);
  readonly formError = signal<string | null>(null);
  readonly picked = signal<number[]>([]);

  // Số NCC theo từng danh mục (chỉ đếm NCC đang có trong danh sách)
  readonly catCounts = computed(() => {
    const counts: Record<number, number> = {};
    for (const s of this.suppliers()) {
      for (const c of s.danh_muc ?? []) {
        counts[c.MaDanhMuc] = (counts[c.MaDanhMuc] ?? 0) + 1;
      }
    }
    return counts;
  });

  // Chip lọc: chỉ hiện danh mục đang có ít nhất một nhà cung cấp
  readonly catChips = computed(() =>
    this.categories()
      .map((c) => ({
        MaDanhMuc: c.MaDanhMuc,
        TenDanhMuc: c.TenDanhMuc,
        count: this.catCounts()[c.MaDanhMuc] ?? 0,
      }))
      .filter((c) => c.count > 0),
  );

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    const cat = this.categoryFilter();

    return this.suppliers().filter((s) => {
      if (cat !== null && !(s.danh_muc ?? []).some((c) => c.MaDanhMuc === cat)) return false;
      if (!k) return true;
      return normalize(
        `${s.TenNhaCungCap} ${s.DiaChi} ${s.SoDienThoai} ${(s.danh_muc ?? []).map((c) => c.TenDanhMuc).join(' ')}`,
      ).includes(k);
    });
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

  toggleCategory(id: number) {
    this.categoryFilter.update((v) => (v === id ? null : id));
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

  onEnter(e: Event) {
    if (!plainEnter(e) || this.form.invalid || this.picked().length === 0 || this.busy()) return;
    e.preventDefault();
    this.save();
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
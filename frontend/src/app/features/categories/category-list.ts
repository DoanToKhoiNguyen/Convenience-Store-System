import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Category } from './category.model';
import { CategoryService } from './category.service';
import { ConfirmService } from '../../core/ui/confirm.service';

// Bỏ dấu để gõ "do uong" vẫn tìm ra "Đồ uống"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-category-list',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, TooltipModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-tags text-lg"></i>
        </span>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Danh mục sản phẩm</h1>
          <p class="text-sm text-slate-500">{{ filtered().length }} / {{ items().length }} danh mục</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative w-full sm:w-72">
          <input
            pInputText
            type="search"
            placeholder="Tìm danh mục..."
            class="w-full pl-9"
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
          Thêm danh mục
        </button>
      </div>
    </div>

    @if (success()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5 text-emerald-500"></i>
        <span>{{ success() }}</span>
      </div>
    }
    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
        <span>{{ error() }}</span>
      </div>
    }

    <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <i class="pi pi-list text-emerald-500"></i>
          Danh sách danh mục
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ filtered().length }}</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <th class="px-5 py-3 font-semibold">Tên danh mục</th>
              <th class="px-5 py-3 text-center font-semibold">Số sản phẩm</th>
              <th class="w-28 px-5 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (c of filtered(); track c.MaDanhMuc) {
              <tr class="transition-colors hover:bg-emerald-100/60">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <i class="pi pi-tag text-sm"></i>
                    </span>
                    <span class="font-medium text-slate-800">{{ c.TenDanhMuc }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5 text-center">
                  @if ((c.san_pham_count ?? 0) > 0) {
                    <span class="inline-flex min-w-8 items-center justify-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {{ c.san_pham_count }}
                    </span>
                  } @else {
                    <span class="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      0
                    </span>
                  }
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex justify-end gap-1">
                    <p-button
                      icon="pi pi-pencil"
                      ariaLabel="Sửa danh mục"
                      pTooltip="Sửa danh mục"
                      tooltipPosition="top"
                      size="small"
                      [text]="true"
                      [rounded]="true"
                      (onClick)="openEdit(c)"
                    />
                    <p-button
                      icon="pi pi-trash"
                      ariaLabel="Xóa danh mục"
                      [pTooltip]="canDelete(c) ? 'Xóa danh mục' : 'Đang có ' + c.san_pham_count + ' sản phẩm, chưa thể xóa'"
                      tooltipPosition="top"
                      size="small"
                      [severity]="canDelete(c) ? 'danger' : 'secondary'"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="busy()"
                      (onClick)="remove(c)"
                    />
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="px-5 py-16 text-center">
                  @if (loading()) {
                    <div class="flex flex-col items-center gap-3 text-slate-400">
                      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500"></i>
                      <span class="text-sm">Đang tải danh mục...</span>
                    </div>
                  } @else {
                    <div class="flex flex-col items-center gap-3 text-slate-400">
                      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <i class="pi pi-inbox text-xl"></i>
                      </span>
                      <span class="text-sm text-slate-500">Chưa có danh mục nào.</span>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <p class="mt-3 flex items-start gap-2 text-xs text-slate-500">
      <i class="pi pi-info-circle mt-px shrink-0 text-slate-400"></i>
      <span>
        Danh mục đang có sản phẩm thì không xóa được. Hãy chuyển các sản phẩm sang danh mục khác (ở trang Sản phẩm) trước.
      </span>
    </p>

    <p-dialog
      [header]="editing() ? 'Sửa danh mục' : 'Thêm danh mục'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '30rem', maxWidth: '92vw' }"
    >
      <form [formGroup]="form" class="space-y-4" (ngSubmit)="save()">
        @if (formError()) {
          <div class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <i class="pi pi-exclamation-circle mt-0.5 text-sm text-red-500"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-info-circle text-emerald-500"></i>
            Thông tin danh mục
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Tên danh mục <span class="text-red-500">*</span>
            </label>
            <input
              pInputText
              formControlName="TenDanhMuc"
              class="w-full"
              placeholder="Ví dụ: Đồ uống"
            />
            @if (form.controls.TenDanhMuc.touched && form.controls.TenDanhMuc.hasError('required')) {
              <small class="mt-1 block text-red-600">Vui lòng nhập tên danh mục.</small>
            }
          </div>
        </div>

        @if (editing(); as e) {
          @if ((e.san_pham_count ?? 0) > 0) {
            <p class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <i class="pi pi-info-circle mt-px shrink-0 text-amber-500"></i>
              <span>Đổi tên sẽ cập nhật cho {{ e.san_pham_count }} sản phẩm đang thuộc danh mục này.</span>
            </p>
          }
        }
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
export class CategoryList {
  private service = inject(CategoryService);
  private fb = inject(FormBuilder);
  private confirmDialog = inject(ConfirmService);

  readonly items = signal<Category[]>([]);
  readonly keyword = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Category | null>(null);
  readonly formError = signal<string | null>(null);

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    if (!k) return this.items();
    //return this.items().filter((c) => normalize(c.TenDanhMuc).includes(k));
    return this.items().filter((c) => normalize(c.TenDanhMuc).startsWith(k));
  });

  readonly form = this.fb.nonNullable.group({
    TenDanhMuc: ['', [Validators.required, Validators.maxLength(100)]]
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách danh mục.');
      },
    });
  }

  canDelete(c: Category): boolean {
    return (c.san_pham_count ?? 0) === 0;
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ TenDanhMuc: '' });
    this.dialogOpen.set(true);
  }

  openEdit(c: Category) {
    this.editing.set(c);
    this.formError.set(null);
    this.form.reset({ TenDanhMuc: c.TenDanhMuc });
    this.dialogOpen.set(true);
  }

  save() {
    if (this.form.invalid || this.busy()) return;

    const v = this.form.getRawValue();
    const body = { TenDanhMuc: v.TenDanhMuc.trim() };

    const current = this.editing();
    const request = current
      ? this.service.update(current.MaDanhMuc, body)
      : this.service.create(body);

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: (res) => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  async remove(c: Category) {
    if (!this.canDelete(c)) {
      const msg =
        `Không thể xóa "${c.TenDanhMuc}" vì đang có ${c.san_pham_count} sản phẩm thuộc danh mục này. ` +
        'Hãy chuyển các sản phẩm sang danh mục khác (ở trang Sản phẩm) trước.';
      this.success.set(null);
      this.error.set(msg);
      setTimeout(() => {
        if (this.error() === msg) this.error.set(null);
      }, 6000);
      return;
    }

    const ok = await this.confirmDialog.ask({
      title: 'Xóa danh mục',
      message: `Bạn có chắc muốn xóa danh mục "${c.TenDanhMuc}"?`,
      confirmLabel: 'Xóa danh mục',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.error.set(null);
    this.service.remove(c.MaDanhMuc).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
        this.load();
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
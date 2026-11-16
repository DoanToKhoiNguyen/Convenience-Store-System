import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Category } from './category.model';
import { CategoryService } from './category.service';
import { ConfirmService } from '../../core/ui/confirm.service';

// Bỏ dấu để gõ "do uong" vẫn tìm ra "Đồ uống"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-category-list',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Danh mục sản phẩm</h1>
        <p class="text-sm text-slate-500">{{ filtered().length }} / {{ items().length }} danh mục</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          pInputText
          type="text"
          placeholder="Tìm danh mục..."
          class="w-64"
          [value]="keyword()"
          (input)="keyword.set($any($event.target).value)"
        />
        <p-button label="Thêm danh mục" icon="pi pi-plus" (onClick)="openCreate()" />
      </div>
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[32rem] table-fixed text-left text-sm">
        <thead>
          <tr class="border-b bg-slate-50 text-slate-600">
            <th class="w-1/4 p-3">Mã</th>
            <th class="w-1/4 p-3">Tên danh mục</th>
            <th class="w-1/4 p-3 text-center">Số sản phẩm</th>
            <th class="w-1/4 p-3 text-left">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (c of filtered(); track c.MaDanhMuc) {
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="p-3 truncate">{{ c.MaDanhMuc }}</td>
              <td class="p-3 font-medium text-slate-800 truncate">{{ c.TenDanhMuc }}</td>
              <td class="p-3 text-center">{{ c.san_pham_count ?? 0 }}</td>
              <td class="p-3 text-left">
                <div class="flex justify-start gap-1">
                  <!-- Nút Sửa -->
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

                  <!-- Nút Xóa -->
                  <p-button
                    icon="pi pi-trash"
                    ariaLabel="Xóa danh mục"
                    pTooltip="Xóa danh mục"
                    tooltipPosition="top"
                    size="small"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    [disabled]="busy() || (c.san_pham_count ?? 0) > 0"
                    (onClick)="remove(c)"
                  />
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4" class="p-8 text-center text-slate-500">
                {{ loading() ? 'Đang tải...' : 'Chưa có danh mục nào.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      Danh mục đang có sản phẩm thì không xóa được. Hãy chuyển các sản phẩm sang danh mục khác (ở trang Sản phẩm) trước.
    </p>

    <p-dialog
      [header]="editing() ? 'Sửa danh mục' : 'Thêm danh mục'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '28rem' }"
    >
      <form [formGroup]="form" class="space-y-3" (ngSubmit)="save()">
        @if (formError()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Tên danh mục *</label>
          <input pInputText formControlName="TenDanhMuc" class="w-full" placeholder="Ví dụ: Đồ uống" />
        </div>


        @if (editing(); as e) {
          @if ((e.san_pham_count ?? 0) > 0) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Đổi tên sẽ cập nhật cho {{ e.san_pham_count }} sản phẩm đang thuộc danh mục này.
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
    if ((c.san_pham_count ?? 0) > 0) return;

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
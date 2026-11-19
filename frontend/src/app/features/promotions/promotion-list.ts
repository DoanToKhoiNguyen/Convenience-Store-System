import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { formatDate } from '../shifts/week.util';
import { Promotion, PromotionPayload, PromoType } from './promotion.model';
import { PromotionService } from './promotion.service';
import { ConfirmService } from '../../core/ui/confirm.service';

function promoRules(g: AbstractControl): ValidationErrors | null {
  const errors: ValidationErrors = {};
  if (g.get('LoaiGiam')?.value === 'phan_tram' && Number(g.get('GiaTriGiam')?.value) > 100) {
    errors['percentMax'] = true;
  }
  const s = g.get('NgayBatDau')?.value;
  const e = g.get('NgayKetThuc')?.value;
  if (s && e && e < s) errors['dateRange'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-promotion-list',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, ButtonModule, DialogModule, InputTextModule, TagModule, TooltipModule],
  template: `
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-tag text-lg"></i>
        </span>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Khuyến mãi</h1>
          <p class="mt-0.5 max-w-3xl text-sm text-slate-500">
            Hóa đơn đủ điều kiện sẽ tự động được giảm giá. Nhiều chương trình cùng đủ điều kiện thì chỉ áp dụng một chương trình có lợi nhất.
          </p>
        </div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98]"
        (click)="openCreate()"
      >
        <i class="pi pi-plus text-xs"></i>
        Thêm chương trình
      </button>
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
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <i class="pi pi-list text-emerald-500"></i>
          Danh sách chương trình
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {{ promos().length }} chương trình
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <th class="px-4 py-3 font-semibold">Chương trình</th>
              <th class="px-4 py-3 font-semibold">Mức giảm</th>
              <th class="px-4 py-3 text-right font-semibold">Đơn tối thiểu</th>
              <th class="px-4 py-3 font-semibold">Thời gian</th>
              <th class="px-4 py-3 font-semibold">Trạng thái</th>
              <th class="px-4 py-3 text-right font-semibold">Đã dùng</th>
              <th class="w-28 px-4 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (p of promos(); track p.MaKhuyenMai) {
              <tr class="transition-colors hover:bg-emerald-100/60">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <i class="pi pi-ticket text-xs"></i>
                    </span>
                    <span class="font-medium text-slate-800">{{ p.TenChuongTrinh }}</span>
                  </div>
                </td>
                <td class="px-4 py-3.5">
                  <span class="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    {{ discountText(p) }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-right tabular-nums text-slate-700">
                  {{ p.DieuKienApDung | number: '1.0-0' }} ₫
                </td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                    <i class="pi pi-calendar text-xs text-slate-400"></i>
                    <span>{{ p.NgayBatDau | date: 'dd/MM/yyyy' }}</span>
                    <i class="pi pi-arrow-right text-[9px] text-slate-300"></i>
                    <span>{{ p.NgayKetThuc | date: 'dd/MM/yyyy' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3.5">
                  <p-tag [value]="status(p).label" [severity]="status(p).severity" />
                </td>
                <td class="px-4 py-3.5 text-right">
                  <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {{ p.hoa_don_count ?? 0 }} hóa đơn
                  </span>
                </td>
                <td class="px-4 py-3.5 text-right">
                  <div class="flex justify-end gap-0.5">
                    <p-button
                      icon="pi pi-pencil"
                      ariaLabel="Sửa chương trình"
                      pTooltip="Sửa"
                      tooltipPosition="top"
                      size="small"
                      [text]="true"
                      [rounded]="true"
                      (onClick)="openEdit(p)"
                    />
                    @if (!isOn(p)) {
                      <p-button
                        icon="pi pi-refresh"
                        ariaLabel="Bật lại chương trình"
                        pTooltip="Bật lại"
                        tooltipPosition="top"
                        size="small"
                        severity="success"
                        [text]="true"
                        [rounded]="true"
                        [disabled]="busy()"
                        (onClick)="restore(p)"
                      />
                    }
                    <p-button
                      icon="pi pi-trash"
                      ariaLabel="Xóa chương trình"
                      pTooltip="Xóa"
                      tooltipPosition="top"
                      size="small"
                      severity="danger"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="busy()"
                      (onClick)="remove(p)"
                    />
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-16 text-center">
                  @if (loading()) {
                    <div class="flex flex-col items-center gap-3 text-slate-500">
                      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500"></i>
                      <span class="text-sm">Đang tải chương trình...</span>
                    </div>
                  } @else {
                    <div class="flex flex-col items-center gap-3 text-slate-500">
                      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <i class="pi pi-inbox text-xl"></i>
                      </span>
                      <span class="text-sm">Chưa có chương trình khuyến mãi nào.</span>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa chương trình khuyến mãi' : 'Thêm chương trình khuyến mãi'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '36rem', maxWidth: '94vw' }"
    >
      <form [formGroup]="form" class="space-y-4">
        @if (formError()) {
          <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <!-- Thông tin chương trình -->
        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-ticket text-emerald-500"></i>
            Thông tin chương trình
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên chương trình <span class="text-red-500">*</span>
            </label>
            <input
              pInputText
              formControlName="TenChuongTrinh"
              class="w-full"
              placeholder="Ví dụ: Giảm giá cuối tuần"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Loại giảm <span class="text-red-500">*</span>
              </label>
              <select
                formControlName="LoaiGiam"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="phan_tram">Giảm theo phần trăm</option>
                <option value="so_tien">Giảm số tiền cố định</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Mức giảm <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input
                  pInputText
                  type="number"
                  min="1"
                  formControlName="GiaTriGiam"
                  class="w-full pr-10!"
                />
                <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {{ form.controls.LoaiGiam.value === 'phan_tram' ? '%' : '₫' }}
                </span>
              </div>
            </div>
          </div>
          @if (form.hasError('percentMax')) {
            <small class="flex items-center gap-1.5 text-red-600">
              <i class="pi pi-exclamation-circle text-xs"></i>
              Giảm theo phần trăm không được vượt quá 100.
            </small>
          }
        </div>

        <!-- Điều kiện áp dụng -->
        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-shopping-bag text-emerald-500"></i>
            Điều kiện áp dụng
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Đơn tối thiểu</label>
              <div class="relative">
                <input
                  pInputText
                  type="number"
                  min="0"
                  formControlName="DieuKienApDung"
                  class="w-full pr-10!"
                />
                <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₫</span>
              </div>
            </div>
            @if (form.controls.LoaiGiam.value === 'phan_tram') {
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-700">Giảm tối đa</label>
                <div class="relative">
                  <input
                    pInputText
                    type="number"
                    min="0"
                    formControlName="GiamToiDa"
                    class="w-full pr-10!"
                    placeholder="Không giới hạn"
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₫</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Thời gian áp dụng -->
        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-calendar text-emerald-500"></i>
            Thời gian áp dụng
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Từ ngày <span class="text-red-500">*</span>
              </label>
              <input pInputText type="date" formControlName="NgayBatDau" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Đến hết ngày <span class="text-red-500">*</span>
              </label>
              <input pInputText type="date" formControlName="NgayKetThuc" class="w-full" />
            </div>
          </div>
          @if (form.hasError('dateRange')) {
            <small class="flex items-center gap-1.5 text-red-600">
              <i class="pi pi-exclamation-circle text-xs"></i>
              Ngày kết thúc phải từ ngày bắt đầu trở đi.
            </small>
          }
        </div>

        <!-- Bật chương trình -->
        <label
          class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
          [class]="form.controls.TrangThai.value
            ? 'border-emerald-200 bg-emerald-50/70'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300'"
        >
          <span class="flex items-center gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition"
              [class]="form.controls.TrangThai.value
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'bg-slate-200 text-slate-500'"
            >
              <i class="pi pi-power-off text-xs"></i>
            </span>
            <span>
              <span class="block text-sm font-medium text-slate-800">Bật chương trình này</span>
              <span class="block text-xs text-slate-500">Chương trình chỉ áp dụng cho hóa đơn mới khi được bật.</span>
            </span>
          </span>
          <input type="checkbox" formControlName="TrangThai" class="h-5 w-5 shrink-0 rounded accent-emerald-600" />
        </label>

        @if (editing(); as e) {
          @if ((e.hoa_don_count ?? 0) > 0) {
            <p class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <i class="pi pi-info-circle mt-px shrink-0 text-amber-500"></i>
              <span>
                Chương trình đã áp dụng cho {{ e.hoa_don_count }} hóa đơn. Thay đổi chỉ ảnh hưởng hóa đơn lập sau này.
              </span>
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
export class PromotionList {
  private service = inject(PromotionService);
  private fb = inject(FormBuilder);
  private confirmDialog = inject(ConfirmService);

  readonly promos = signal<Promotion[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Promotion | null>(null);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      TenChuongTrinh: ['', [Validators.required, Validators.maxLength(255)]],
      LoaiGiam: ['phan_tram' as PromoType, Validators.required],
      GiaTriGiam: [null as number | null, [Validators.required, Validators.min(1)]],
      DieuKienApDung: [0 as number | null, Validators.min(0)],
      GiamToiDa: [null as number | null, Validators.min(0)],
      NgayBatDau: ['', Validators.required],
      NgayKetThuc: ['', Validators.required],
      TrangThai: [true],
    },
    { validators: promoRules },
  );

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.promos.set(data);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách khuyến mãi.');
      },
    });
  }

  isOn(p: Promotion) {
    return Number(p.TrangThai) === 1;
  }

  discountText(p: Promotion): string {
    if (p.LoaiGiam === 'so_tien') {
      return `${Number(p.GiaTriGiam).toLocaleString('vi-VN')} ₫`;
    }
    const cap = Number(p.GiamToiDa ?? 0);
    return `${Number(p.GiaTriGiam)}%` + (cap > 0 ? ` (tối đa ${cap.toLocaleString('vi-VN')} ₫)` : '');
  }

  status(p: Promotion): { label: string; severity: 'success' | 'info' | 'warn' | 'secondary' } {
    switch (p.trang_thai_text) {
      case 'dang_chay':
        return { label: 'Đang chạy', severity: 'success' };
      case 'sap_chay':
        return { label: 'Sắp diễn ra', severity: 'info' };
      case 'het_han':
        return { label: 'Hết hạn', severity: 'secondary' };
      default:
        return { label: 'Tạm ngưng', severity: 'warn' };
    }
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    const today = formatDate(new Date());
    this.form.reset({
      TenChuongTrinh: '',
      LoaiGiam: 'phan_tram',
      GiaTriGiam: null,
      DieuKienApDung: 0,
      GiamToiDa: null,
      NgayBatDau: today,
      NgayKetThuc: today,
      TrangThai: true,
    });
    this.dialogOpen.set(true);
  }

  openEdit(p: Promotion) {
    this.editing.set(p);
    this.formError.set(null);
    this.form.reset({
      TenChuongTrinh: p.TenChuongTrinh,
      LoaiGiam: p.LoaiGiam,
      GiaTriGiam: Number(p.GiaTriGiam),
      DieuKienApDung: Number(p.DieuKienApDung ?? 0),
      GiamToiDa: p.GiamToiDa != null ? Number(p.GiamToiDa) : null,
      NgayBatDau: formatDate(new Date(p.NgayBatDau)),   // đổi sang ngày giờ địa phương
      NgayKetThuc: formatDate(new Date(p.NgayKetThuc)),
      TrangThai: this.isOn(p),
    });
    this.dialogOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const body: PromotionPayload = {
      TenChuongTrinh: (v.TenChuongTrinh ?? '').trim(),
      LoaiGiam: v.LoaiGiam ?? 'phan_tram',
      GiaTriGiam: Number(v.GiaTriGiam),
      DieuKienApDung: Number(v.DieuKienApDung ?? 0),
      GiamToiDa: v.LoaiGiam === 'phan_tram' && v.GiamToiDa ? Number(v.GiamToiDa) : null,
      NgayBatDau: v.NgayBatDau ?? '',
      NgayKetThuc: v.NgayKetThuc ?? '',
      TrangThai: !!v.TrangThai,
    };

    const current = this.editing();
    const request = current
      ? this.service.update(current.MaKhuyenMai, body)
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

  async remove(p: Promotion) {
    const ok = await this.confirmDialog.ask({
      title: 'Xóa chương trình khuyến mãi',
      message:
        `Bạn có chắc muốn xóa chương trình "${p.TenChuongTrinh}"?\n` +
        'Nếu đã áp dụng cho hóa đơn, hệ thống chỉ chuyển sang "Tạm ngưng".',
      confirmLabel: 'Xóa chương trình',
      tone: 'danger',
    });

    if (!ok) return;

    this.busy.set(true);
    this.service.remove(p.MaKhuyenMai).subscribe({
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

  restore(p: Promotion) {
    this.busy.set(true);
    this.service.restore(p.MaKhuyenMai).subscribe({
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
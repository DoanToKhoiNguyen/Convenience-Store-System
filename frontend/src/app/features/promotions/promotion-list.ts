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
import { formatDate } from '../shifts/week.util';
import { Promotion, PromotionPayload, PromoType } from './promotion.model';
import { PromotionService } from './promotion.service';

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
    imports: [ReactiveFormsModule, DatePipe, DecimalPipe, ButtonModule, DialogModule, InputTextModule, TagModule],
    template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Khuyến mãi</h1>
        <p class="text-sm text-slate-500">
          Hóa đơn đủ điều kiện sẽ tự động được giảm giá. Nhiều chương trình cùng đủ điều kiện thì chỉ áp dụng một chương trình có lợi nhất.
        </p>
      </div>
      <p-button label="Thêm chương trình" icon="pi pi-plus" (onClick)="openCreate()" />
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[56rem] text-left text-sm">
        <thead>
          <tr class="border-b bg-slate-50 text-slate-600">
            <th class="p-3">Chương trình</th>
            <th class="p-3">Mức giảm</th>
            <th class="p-3 text-right">Đơn tối thiểu</th>
            <th class="p-3">Thời gian</th>
            <th class="p-3">Trạng thái</th>
            <th class="p-3 text-right">Đã dùng</th>
            <th class="p-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (p of promos(); track p.MaKhuyenMai) {
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="p-3 font-medium text-slate-800">{{ p.TenChuongTrinh }}</td>
              <td class="p-3">{{ discountText(p) }}</td>
              <td class="p-3 text-right">{{ p.DieuKienApDung | number: '1.0-0' }} ₫</td>
              <td class="p-3">
                {{ p.NgayBatDau | date: 'dd/MM/yyyy' }} – {{ p.NgayKetThuc | date: 'dd/MM/yyyy' }}
              </td>
              <td class="p-3"><p-tag [value]="status(p).label" [severity]="status(p).severity" /></td>
              <td class="p-3 text-right">{{ p.hoa_don_count ?? 0 }} hóa đơn</td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <p-button label="Sửa" size="small" [text]="true" (onClick)="openEdit(p)" />
                  @if (!isOn(p)) {
                    <p-button label="Bật lại" size="small" severity="success" [text]="true" [disabled]="busy()" (onClick)="restore(p)" />
                  }
                  <p-button label="Xóa" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="remove(p)" />
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="p-8 text-center text-slate-500">
                {{ loading() ? 'Đang tải...' : 'Chưa có chương trình khuyến mãi nào.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa chương trình khuyến mãi' : 'Thêm chương trình khuyến mãi'"
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
          <label class="mb-1 block text-sm font-medium text-slate-700">Tên chương trình *</label>
          <input pInputText formControlName="TenChuongTrinh" class="w-full" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Loại giảm *</label>
            <select formControlName="LoaiGiam" class="w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="phan_tram">Giảm theo phần trăm (%)</option>
              <option value="so_tien">Giảm số tiền cố định (₫)</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Mức giảm * ({{ form.controls.LoaiGiam.value === 'phan_tram' ? '%' : '₫' }})
            </label>
            <input pInputText type="number" min="1" formControlName="GiaTriGiam" class="w-full" />
          </div>
        </div>
        @if (form.hasError('percentMax')) {
          <small class="text-red-600">Giảm theo phần trăm không được vượt quá 100.</small>
        }

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Đơn tối thiểu (₫)</label>
            <input pInputText type="number" min="0" formControlName="DieuKienApDung" class="w-full" />
          </div>
          @if (form.controls.LoaiGiam.value === 'phan_tram') {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Giảm tối đa (₫)</label>
              <input pInputText type="number" min="0" formControlName="GiamToiDa" class="w-full" placeholder="Không giới hạn" />
            </div>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Từ ngày *</label>
            <input pInputText type="date" formControlName="NgayBatDau" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Đến hết ngày *</label>
            <input pInputText type="date" formControlName="NgayKetThuc" class="w-full" />
          </div>
        </div>
        @if (form.hasError('dateRange')) {
          <small class="text-red-600">Ngày kết thúc phải từ ngày bắt đầu trở đi.</small>
        }

        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" formControlName="TrangThai" class="h-4 w-4" />
          Bật chương trình này
        </label>

        @if (editing(); as e) {
          @if ((e.hoa_don_count ?? 0) > 0) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chương trình đã áp dụng cho {{ e.hoa_don_count }} hóa đơn. Thay đổi chỉ ảnh hưởng hóa đơn lập sau này.
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

    remove(p: Promotion) {
        if (
            !confirm(
                `Xóa chương trình "${p.TenChuongTrinh}"?\nNếu đã áp dụng cho hóa đơn, hệ thống chỉ chuyển sang "Tạm ngưng".`,
            )
        )
            return;

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
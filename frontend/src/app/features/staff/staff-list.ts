import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE, ROLE_LABEL } from '../../core/auth/roles';
import { Staff, StaffPayload } from './staff.model';
import { StaffService } from './staff.service';

@Component({
  selector: 'app-staff-list',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule, TooltipModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-users text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Nhân viên</h1>
          <p class="text-sm text-slate-500">{{ staff().length }} tài khoản</p>
        </div>
      </div>
      @if (canEdit()) {
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98]"
          (click)="openCreate()"
        >
          <i class="pi pi-plus text-xs"></i>
          Thêm nhân viên
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
          Danh sách tài khoản
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ staff().length }}</span>
        </div>
      </div>

      <p-table
        [value]="staff()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        dataKey="MaTaiKhoan"
        [tableStyle]="{ 'min-width': '52rem' }"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th class="min-w-[14rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Họ tên</th>
            <th class="min-w-[9rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tên đăng nhập</th>
            <th class="min-w-[14rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</th>
            <th class="min-w-[9rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Số điện thoại</th>
            <th class="min-w-[8rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vai trò</th>
            <th class="min-w-[8rem] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
            @if (canEdit()) {
              <th class="w-28 px-4 py-3 text-right! text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
            }
          </tr>
        </ng-template>

        <ng-template #body let-s>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td class="whitespace-normal! px-4 py-3">
              <div class="flex items-start gap-2.5">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <i class="pi pi-user text-xs"></i>
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="font-medium text-slate-800">{{ s.HoTen }}</span>
                    @if (isMe(s)) {
                      <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">Bạn</span>
                    }
                  </div>
                </div>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{{ s.TenDangNhap }}</td>
            <td class="whitespace-normal! px-4 py-3 text-slate-600">{{ s.Email }}</td>
            <td class="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{{ s.SoDienThoai ?? '—' }}</td>
            <td class="whitespace-nowrap px-4 py-3">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                <i class="pi pi-shield text-[10px]"></i>
                {{ roleName(s) }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <p-tag
                [value]="isActive(s) ? 'Hoạt động' : 'Đã khóa'"
                [severity]="isActive(s) ? 'success' : 'danger'"
              />
            </td>
            @if (canEdit()) {
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-1">
                  <p-button
                    icon="pi pi-pencil"
                    size="small"
                    [text]="true"
                    [rounded]="true"
                    ariaLabel="Sửa nhân viên"
                    pTooltip="Sửa"
                    tooltipPosition="top"
                    (onClick)="openEdit(s)"
                  />
                  @if (!isMe(s)) {
                    <p-button
                      [icon]="isActive(s) ? 'pi pi-lock' : 'pi pi-lock-open'"
                      size="small"
                      [severity]="isActive(s) ? 'danger' : 'success'"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="busy()"
                      [ariaLabel]="isActive(s) ? 'Khóa tài khoản' : 'Mở khóa tài khoản'"
                      [pTooltip]="isActive(s) ? 'Khóa' : 'Mở khóa'"
                      tooltipPosition="top"
                      (onClick)="toggleLock(s)"
                    />
                  }
                </div>
              </td>
            }
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td [attr.colspan]="canEdit() ? 7 : 6" class="px-4 py-12">
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
                  <span class="text-sm text-slate-500">Chưa có nhân viên nào.</span>
                </div>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa nhân viên' : 'Thêm nhân viên'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '32rem', maxWidth: '94vw' }"
    >
      <form [formGroup]="form" class="space-y-4">
        @if (formError()) {
          <div class="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <i class="pi pi-exclamation-circle mt-0.5 text-sm"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-id-card text-emerald-500"></i>
            Thông tin tài khoản
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Họ tên</label>
            <input pInputText formControlName="HoTen" class="w-full" />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Tên đăng nhập</label>
              <input pInputText formControlName="TenDangNhap" class="w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
              <input pInputText formControlName="SoDienThoai" class="w-full" />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input pInputText type="email" formControlName="Email" class="w-full" />
          </div>

          @if (!editing()) {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Mật khẩu</label>
              <input pInputText type="password" formControlName="MatKhau" class="w-full" autocomplete="new-password" />
            </div>
          }
        </div>

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-shield text-emerald-500"></i>
            Phân quyền &amp; trạng thái
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Vai trò</label>
              <select
                formControlName="MaVaiTro"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
              >
                @for (r of roles; track r.value) {
                  <option [ngValue]="r.value">{{ r.label }}</option>
                }
              </select>
            </div>

            @if (editing()) {
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">Trạng thái</label>
                <select
                  formControlName="TrangThai"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option [ngValue]="true">Hoạt động</option>
                  <option [ngValue]="false">Đã khóa</option>
                </select>
              </div>
            }
          </div>

          @if (editing() && isMe(editing()!)) {
            <p class="flex items-start gap-1.5 text-xs text-slate-500">
              <i class="pi pi-info-circle mt-0.5 text-[11px] text-slate-400"></i>
              Bạn không thể tự đổi vai trò hoặc tự khóa tài khoản của mình.
            </p>
          }
          @if (editing()) {
            <p class="flex items-start gap-1.5 text-xs text-slate-500">
              <i class="pi pi-info-circle mt-0.5 text-[11px] text-slate-400"></i>
              Tên đăng nhập và mật khẩu không được sửa tại đây. Tài khoản bị khóa sẽ bị đăng xuất và không làm được thao tác nào.
            </p>
          }
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" (onClick)="dialogOpen.set(false)" />
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
export class StaffList {
  private service = inject(StaffService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly roles = [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF].map((v) => ({
    value: v as number,
    label: ROLE_LABEL[v],
  }));

  readonly staff = signal<Staff[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Staff | null>(null);
  readonly formError = signal<string | null>(null);

  // Chỉ chủ doanh nghiệp được thêm / sửa / khóa (khớp route role:1 ở backend)
  readonly canEdit = computed(() => this.auth.hasAnyRole([ROLE.OWNER]));

  readonly form = this.fb.nonNullable.group({
    HoTen: ['', Validators.required],
    TenDangNhap: ['', Validators.required],
    SoDienThoai: [''],
    Email: ['', [Validators.required, Validators.email]],
    MaVaiTro: [ROLE.STAFF as number, Validators.required],
    TrangThai: [true],
    MatKhau: [''],
  });

  constructor() {
    this.load();
  }

  isActive(s: Staff) {
    return Number(s.TrangThai) === 1;
  }

  isMe(s: Staff) {
    return s.MaTaiKhoan === this.auth.user()?.MaTaiKhoan;
  }

  roleName(s: Staff) {
    return ROLE_LABEL[Number(s.MaVaiTro)] ?? String(s.MaVaiTro);
  }

  load() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.staff.set(data ?? []);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách nhân viên.');
      },
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      HoTen: '', TenDangNhap: '', SoDienThoai: '', Email: '',
      MaVaiTro: ROLE.STAFF, TrangThai: true, MatKhau: '',
    });
    this.form.controls.TenDangNhap.enable();
    this.form.controls.MaVaiTro.enable();
    this.form.controls.TrangThai.enable();
    this.form.controls.MatKhau.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.MatKhau.updateValueAndValidity();
    this.dialogOpen.set(true);
  }

  openEdit(s: Staff) {
    this.editing.set(s);
    this.formError.set(null);
    this.form.reset({
      HoTen: s.HoTen,
      TenDangNhap: s.TenDangNhap,
      SoDienThoai: s.SoDienThoai ?? '',
      Email: s.Email,
      MaVaiTro: Number(s.MaVaiTro),
      TrangThai: this.isActive(s),
      MatKhau: '',
    });

    // Khi sửa: không cho đổi tên đăng nhập, không có mật khẩu
    this.form.controls.TenDangNhap.disable();
    this.form.controls.MatKhau.clearValidators();
    this.form.controls.MatKhau.updateValueAndValidity();

    // Tự sửa chính mình: không được đổi vai trò / trạng thái
    if (this.isMe(s)) {
      this.form.controls.MaVaiTro.disable();
      this.form.controls.TrangThai.disable();
    } else {
      this.form.controls.MaVaiTro.enable();
      this.form.controls.TrangThai.enable();
    }
    this.dialogOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const current = this.editing();

    if (current) {
      const lockingNow = !v.TrangThai && this.isActive(current);
      if (lockingNow && !confirm(`Khóa tài khoản "${current.HoTen}"? Họ sẽ bị đăng xuất ngay.`)) return;
    }

    let request;
    if (current) {
      const body: StaffPayload = {
        HoTen: v.HoTen,
        Email: v.Email,
        SoDienThoai: v.SoDienThoai || null,
      };
      if (!this.isMe(current)) {
        body.MaVaiTro = Number(v.MaVaiTro);
        body.TrangThai = v.TrangThai;
      }
      request = this.service.update(current.MaTaiKhoan, body);
    } else {
      request = this.service.create({
        HoTen: v.HoTen,
        TenDangNhap: v.TenDangNhap,
        SoDienThoai: v.SoDienThoai || null,
        Email: v.Email,
        MaVaiTro: Number(v.MaVaiTro),
        MatKhau: v.MatKhau,
      });
    }

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.notify(current ? 'Đã cập nhật nhân viên.' : 'Đã thêm nhân viên.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  toggleLock(s: Staff) {
    const lock = this.isActive(s);
    const text = lock
      ? `Khóa tài khoản "${s.HoTen}"? Họ sẽ bị đăng xuất và không thể đăng nhập.`
      : `Mở khóa tài khoản "${s.HoTen}"?`;
    if (!confirm(text)) return;

    this.busy.set(true);
    this.error.set(null);
    this.service.update(s.MaTaiKhoan, { TrangThai: !lock }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify(lock ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
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
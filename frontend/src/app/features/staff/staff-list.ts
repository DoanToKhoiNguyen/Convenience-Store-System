import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE, ROLE_LABEL } from '../../core/auth/roles';
import { Staff, StaffPayload } from './staff.model';
import { StaffService } from './staff.service';

@Component({
  selector: 'app-staff-list',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule, DialogModule, InputTextModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Nhân viên</h1>
        <p class="text-sm text-slate-500">{{ staff().length }} tài khoản</p>
      </div>
      @if (canEdit()) {
        <p-button label="Thêm nhân viên" icon="pi pi-plus" (onClick)="openCreate()" />
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
        [value]="staff()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        dataKey="MaTaiKhoan"
        [tableStyle]="{ 'min-width': '50rem' }"
      >
        <ng-template #header>
          <tr>
            <th>Họ tên</th>
            <th>Tên đăng nhập</th>
            <th>Email</th>
            <th>Số điện thoại</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            @if (canEdit()) {
              <th class="text-right">Thao tác</th>
            }
          </tr>
        </ng-template>

        <ng-template #body let-s>
          <tr>
            <td class="font-medium text-slate-800">{{ s.HoTen }}</td>
            <td>{{ s.TenDangNhap }}</td>
            <td>{{ s.Email }}</td>
            <td>{{ s.SoDienThoai ?? '—' }}</td>
            <td>{{ roleName(s) }}</td>
            <td>
              <p-tag
                [value]="isActive(s) ? 'Hoạt động' : 'Đã khóa'"
                [severity]="isActive(s) ? 'success' : 'danger'"
              />
            </td>
            @if (canEdit()) {
              <td class="text-right">
                <div class="flex justify-end gap-1">
                  <p-button label="Sửa" size="small" [text]="true" (onClick)="openEdit(s)" />
                  @if (!isMe(s)) {
                    <p-button
                      [label]="isActive(s) ? 'Khóa' : 'Mở khóa'"
                      size="small"
                      [severity]="isActive(s) ? 'danger' : 'success'"
                      [text]="true"
                      [disabled]="busy()"
                      (onClick)="toggleLock(s)"
                    />
                  }
                </div>
              </td>
            }
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr><td colspan="7" class="py-8 text-center text-slate-500">Chưa có nhân viên nào.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa nhân viên' : 'Thêm nhân viên'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '30rem' }"
    >
      <form [formGroup]="form" class="space-y-3">
        @if (formError()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Họ tên</label>
          <input pInputText formControlName="HoTen" class="w-full" />
        </div>

        <div class="grid grid-cols-2 gap-3">
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

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Vai trò</label>
            <select formControlName="MaVaiTro" class="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100">
              @for (r of roles; track r.value) {
                <option [ngValue]="r.value">{{ r.label }}</option>
              }
            </select>
          </div>

          @if (editing()) {
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Trạng thái</label>
              <select formControlName="TrangThai" class="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100">
                <option [ngValue]="true">Hoạt động</option>
                <option [ngValue]="false">Đã khóa</option>
              </select>
            </div>
          }
        </div>

        @if (editing() && isMe(editing()!)) {
          <p class="text-xs text-slate-500">Bạn không thể tự đổi vai trò hoặc tự khóa tài khoản của mình.</p>
        }
        @if (editing()) {
          <p class="text-xs text-slate-500">
            Tên đăng nhập và mật khẩu không được sửa tại đây. Tài khoản bị khóa sẽ bị đăng xuất và không làm được thao tác nào.
          </p>
        }

        @if (!editing()) {
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Mật khẩu</label>
            <input pInputText type="password" formControlName="MatKhau" class="w-full" autocomplete="new-password" />
          </div>
        }
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
        this.staff.set(data);
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
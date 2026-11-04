import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABEL } from '../../core/auth/roles';

@Component({
    selector: 'app-profile',
    imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TagModule],
    template: `
    <h1 class="mb-4 text-2xl font-semibold text-slate-800">Thông tin cá nhân</h1>

    <div class="grid max-w-5xl gap-6 lg:grid-cols-2">
      <!-- Thông tin cá nhân -->
      <form [formGroup]="infoForm" (ngSubmit)="saveInfo()" class="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 class="font-medium text-slate-700">Thông tin tài khoản</h2>

        @if (infoMsg()) {
          <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{{ infoMsg() }}</div>
        }
        @if (infoErr()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ infoErr() }}</div>
        }

        <div class="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <div class="text-slate-500">Tên đăng nhập</div>
            <div class="font-medium text-slate-800">{{ auth.user()?.TenDangNhap }}</div>
          </div>
          <div>
            <div class="text-slate-500">Vai trò</div>
            <div class="font-medium text-slate-800">{{ roleName() }}</div>
          </div>
          <div>
            <div class="text-slate-500">Trạng thái</div>
            <p-tag [value]="active() ? 'Hoạt động' : 'Đã khóa'" [severity]="active() ? 'success' : 'danger'" />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Họ tên</label>
          <input pInputText formControlName="HoTen" class="w-full" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input pInputText type="email" formControlName="Email" class="w-full" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
          <input pInputText formControlName="SoDienThoai" class="w-full" />
        </div>

        <p-button
          type="submit"
          label="Lưu thay đổi"
          icon="pi pi-check"
          [loading]="infoBusy()"
          [disabled]="infoForm.invalid || infoForm.pristine || infoBusy()"
        />
        <p class="text-xs text-slate-500">
          Tên đăng nhập, vai trò và trạng thái chỉ do chủ doanh nghiệp thay đổi.
        </p>
      </form>

      <!-- Đổi mật khẩu -->
      <form [formGroup]="pwdForm" (ngSubmit)="savePassword()" class="h-fit space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 class="font-medium text-slate-700">Đổi mật khẩu</h2>

        @if (pwdMsg()) {
          <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{{ pwdMsg() }}</div>
        }
        @if (pwdErr()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ pwdErr() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Mật khẩu hiện tại</label>
          <input pInputText type="password" formControlName="MatKhauCu" class="w-full" autocomplete="current-password" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Mật khẩu mới (tối thiểu 6 ký tự)</label>
          <input pInputText type="password" formControlName="MatKhauMoi" class="w-full" autocomplete="new-password" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Nhập lại mật khẩu mới</label>
          <input pInputText type="password" formControlName="NhapLaiMatKhau" class="w-full" autocomplete="new-password" />
          @if (pwdForm.hasError('mismatch') && pwdForm.controls.NhapLaiMatKhau.dirty) {
            <small class="text-red-600">Mật khẩu nhập lại chưa khớp.</small>
          }
        </div>

        <p-button
          type="submit"
          label="Đổi mật khẩu"
          icon="pi pi-key"
          [loading]="pwdBusy()"
          [disabled]="pwdForm.invalid || pwdBusy()"
        />
        <p class="text-xs text-slate-500">Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.</p>
      </form>
    </div>
  `,
})
export class Profile {
    protected auth = inject(AuthService);
    private fb = inject(FormBuilder);

    readonly roleName = computed(() => ROLE_LABEL[this.auth.user()?.MaVaiTro ?? 0] ?? '');
    readonly active = computed(() => !!Number(this.auth.user()?.TrangThai ?? 1));

    readonly infoBusy = signal(false);
    readonly infoMsg = signal<string | null>(null);
    readonly infoErr = signal<string | null>(null);

    readonly pwdBusy = signal(false);
    readonly pwdMsg = signal<string | null>(null);
    readonly pwdErr = signal<string | null>(null);

    readonly infoForm = this.fb.nonNullable.group({
        HoTen: ['', Validators.required],
        Email: ['', [Validators.required, Validators.email]],
        SoDienThoai: [''],
    });

    readonly pwdForm = this.fb.nonNullable.group(
        {
            MatKhauCu: ['', Validators.required],
            MatKhauMoi: ['', [Validators.required, Validators.minLength(6)]],
            NhapLaiMatKhau: ['', Validators.required],
        },
        {
            validators: (g) =>
                g.get('MatKhauMoi')?.value === g.get('NhapLaiMatKhau')?.value ? null : { mismatch: true },
        },
    );

    constructor() {
        const u = this.auth.user();
        if (u) {
            this.infoForm.reset({
                HoTen: u.HoTen ?? '',
                Email: u.Email ?? '',
                SoDienThoai: u.SoDienThoai ?? '',
            });
        }
    }

    saveInfo() {
        if (this.infoForm.invalid) return;
        const v = this.infoForm.getRawValue();

        this.infoBusy.set(true);
        this.infoMsg.set(null);
        this.infoErr.set(null);

        this.auth
            .updateProfile({ HoTen: v.HoTen, Email: v.Email, SoDienThoai: v.SoDienThoai || null })
            .subscribe({
                next: () => {
                    this.infoBusy.set(false);
                    this.infoForm.markAsPristine();
                    this.infoMsg.set('Đã cập nhật thông tin cá nhân.');
                },
                error: (e: HttpErrorResponse) => {
                    this.infoBusy.set(false);
                    this.infoErr.set(this.errorText(e));
                },
            });
    }

    savePassword() {
        if (this.pwdForm.invalid) return;

        this.pwdBusy.set(true);
        this.pwdMsg.set(null);
        this.pwdErr.set(null);

        this.auth.changePassword(this.pwdForm.getRawValue()).subscribe({
            next: () => {
                this.pwdBusy.set(false);
                this.pwdForm.reset();
                this.pwdMsg.set('Đã đổi mật khẩu.');
            },
            error: (e: HttpErrorResponse) => {
                this.pwdBusy.set(false);
                this.pwdErr.set(this.errorText(e));
            },
        });
    }

    private errorText(e: HttpErrorResponse): string {
        const errs = e.error?.errors as Record<string, string[]> | undefined;
        if (errs) return Object.values(errs).flat().join(' ');
        return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
    }
}
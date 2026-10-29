import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div class="text-center">
          <i class="pi pi-shop text-4xl text-emerald-600"></i>
          <h1 class="mt-2 text-xl font-semibold text-slate-800">Cửa hàng tiện lợi</h1>
          <p class="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
        </div>

        @if (error()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error() }}</div>
        }

        <div class="space-y-1">
          <label for="username" class="text-sm font-medium text-slate-700">Tên đăng nhập</label>
          <input pInputText id="username" formControlName="username" class="w-full" autofocus />
          @if (form.controls.username.touched && form.controls.username.invalid) {
            <small class="text-red-600">Vui lòng nhập tên đăng nhập</small>
          }
        </div>

        <div class="space-y-1">
          <label for="password" class="text-sm font-medium text-slate-700">Mật khẩu</label>
          <p-password
            inputId="password"
            formControlName="password"
            [feedback]="false"
            [toggleMask]="true"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <small class="text-red-600">Vui lòng nhập mật khẩu</small>
          }
        </div>

        <p-button
          type="submit"
          label="Đăng nhập"
          icon="pi pi-sign-in"
          styleClass="w-full"
          [loading]="loading()"
        />
      </form>
    </div>
  `,
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.toMessage(e));
      },
    });
  }

  private toMessage(e: HttpErrorResponse): string {
    if (e.status === 0) return 'Không kết nối được máy chủ.';
    if (e.status === 422) {
      const errors = e.error?.errors as Record<string, string[]> | undefined;
      const first = errors ? Object.values(errors)[0]?.[0] : null;
      return first ?? e.error?.message ?? 'Dữ liệu không hợp lệ.';
    }
    if (e.status === 401) return e.error?.message ?? 'Sai tên đăng nhập hoặc mật khẩu.';
    if (e.status === 403) return e.error?.message ?? 'Tài khoản đã bị khóa.';
    if (e.status === 429) return 'Bạn thử quá nhiều lần, vui lòng đợi một phút.';
    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }
}
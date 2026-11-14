
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
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule
  ],
  template: `
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-emerald-50 to-slate-100 px-4 py-10">

      <!-- Background decoration -->
      <div class="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl"></div>

      <!-- Login card -->
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="relative z-10 w-full max-w-md space-y-7 rounded-3xl border border-white/70 bg-white p-8 shadow-xl shadow-slate-200/70 sm:p-10"
      >

        <!-- Logo and heading -->
        <div class="text-center">

          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
            <i class="pi pi-shop text-3xl text-emerald-600"></i>
          </div>

          <h1 class="mt-5 text-2xl font-bold tracking-tight text-slate-800">
            Cửa hàng tiện lợi
          </h1>

          <p class="mt-2 text-sm text-slate-500">
            Chào mừng bạn quay trở lại!
          </p>

          <p class="mt-1 text-sm text-slate-400">
            Đăng nhập để tiếp tục sử dụng hệ thống
          </p>
        </div>

        <!-- Error message -->
        @if (error()) {
          <div
            role="alert"
            class="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <i class="pi pi-exclamation-circle mt-0.5"></i>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- Username -->
        <div class="space-y-2">
          <label
            for="username"
            class="block text-sm font-semibold text-slate-700"
          >
            Tên đăng nhập
            <span class="text-red-500">*</span>
          </label>

          <input
            pInputText
            id="username"
            formControlName="username"
            placeholder="Nhập tên đăng nhập"
            autocomplete="username"
            autofocus
            class="w-full !rounded-xl !border-slate-200 !px-4 !py-3 !text-sm !shadow-sm transition-all focus:!border-emerald-500 focus:!ring-2 focus:!ring-emerald-100"
          />

          @if (
            form.controls.username.touched &&
            form.controls.username.invalid
          ) {
            <small class="flex items-center gap-1 text-sm text-red-500">
              <i class="pi pi-info-circle"></i>
              Vui lòng nhập tên đăng nhập
            </small>
          }
        </div>

        <!-- Password -->
        <div class="space-y-2">
          <label
            for="password"
            class="block text-sm font-semibold text-slate-700"
          >
            Mật khẩu
            <span class="text-red-500">*</span>
          </label>

          <p-password
            inputId="password"
            formControlName="password"
            placeholder="Nhập mật khẩu"
            autocomplete="current-password"
            [feedback]="false"
            [toggleMask]="true"
            styleClass="w-full block"
            inputStyleClass="w-full !rounded-xl !border-slate-200 !px-4 !py-3 !text-sm !shadow-sm"
            [style]="{ width: '100%' }"
            [inputStyle]="{ width: '100%' }"
          />

          @if (
            form.controls.password.touched &&
            form.controls.password.invalid
          ) {
            <small class="flex items-center gap-1 text-sm text-red-500">
              <i class="pi pi-info-circle"></i>
              Vui lòng nhập mật khẩu
            </small>
          }
        </div>

        <!-- Submit button -->
        <p-button
          type="submit"
          label="Đăng nhập"
          icon="pi pi-sign-in"
          iconPos="right"
          styleClass="w-full !rounded-xl !border-0 !bg-emerald-600 !py-3 !font-semibold !shadow-md !shadow-emerald-200 transition-all hover:!bg-emerald-700 hover:!shadow-lg"
          [loading]="loading()"
          [disabled]="loading()"
        />

        <!-- Footer -->
        <div class="border-t border-slate-100 pt-5 text-center">
          <p class="text-xs text-slate-400">
            © 2026 Cửa hàng tiện lợi. All rights reserved.
          </p>
          <p class="mt-1 text-xs text-slate-400">
            Hệ thống quản lý bán hàng
          </p>
        </div>

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

    if (e.status === 401) {
      return e.error?.message ?? 'Sai tên đăng nhập hoặc mật khẩu.';
    }

    if (e.status === 403) {
      return e.error?.message ?? 'Tài khoản đã bị khóa.';
    }

    if (e.status === 429) {
      return 'Bạn thử quá nhiều lần, vui lòng đợi một phút.';
    }

    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }
}

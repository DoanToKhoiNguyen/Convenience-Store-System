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
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030f0b] px-4 py-10">

      <!-- Nền màu "ảo": mesh gradient + quầng sáng + lưới mờ -->
      <div
        class="pointer-events-none absolute inset-0"
        style="background:
          radial-gradient(55% 45% at 15% 18%, rgba(16,185,129,0.38), transparent 62%),
          radial-gradient(50% 40% at 86% 12%, rgba(45,212,191,0.28), transparent 60%),
          radial-gradient(60% 55% at 82% 88%, rgba(99,102,241,0.30), transparent 65%),
          radial-gradient(45% 45% at 18% 92%, rgba(20,184,166,0.30), transparent 62%),
          linear-gradient(160deg, #04140f 0%, #030f0b 45%, #020a08 100%);"
      ></div>
      <div class="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 animate-pulse rounded-full bg-emerald-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"></div>
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.06]"
        style="background-image: linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px); background-size: 56px 56px;"
      ></div>

      <!-- Card kính mờ -->
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="relative z-10 w-full max-w-[26rem] space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-9"
      >

        <!-- Logo and heading -->
        <div class="text-center">

          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-emerald-950 shadow-[0_0_35px_-5px_rgba(52,211,153,0.7)]">
            <i class="pi pi-shop text-3xl"></i>
          </div>

          <h1 class="mt-5 text-2xl font-bold tracking-tight text-white">
            Cửa hàng tiện lợi
          </h1>

          <p class="mt-2 text-sm text-white/60">
            Chào mừng bạn quay trở lại!
          </p>

          <p class="mt-1 text-xs text-white/40">
            Đăng nhập để tiếp tục sử dụng hệ thống
          </p>
        </div>

        <!-- Error message -->
        @if (error()) {
          <div
            role="alert"
            class="flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <i class="pi pi-exclamation-circle mt-0.5"></i>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- Username -->
        <div class="space-y-2">
          <label
            for="username"
            class="block text-xs font-semibold tracking-wide text-white/55"
          >
            Tên đăng nhập
            <span class="text-red-400">*</span>
          </label>

          <div class="relative">
            <i class="pi pi-user pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35"></i>
            <input
              pInputText
              id="username"
              formControlName="username"
              placeholder="Nhập tên đăng nhập"
              autocomplete="username"
              autofocus
              class="w-full !rounded-full !border !border-white/20 !bg-white/5 !py-3 !pl-11 !pr-5 !text-sm !text-white placeholder:!text-white/35 transition-all focus:!border-emerald-400/60 focus:!ring-2 focus:!ring-emerald-400/25"
            />
          </div>

          @if (
            form.controls.username.touched &&
            form.controls.username.invalid
          ) {
            <small class="flex items-center gap-1 text-sm text-red-300">
              <i class="pi pi-info-circle"></i>
              Vui lòng nhập tên đăng nhập
            </small>
          }
        </div>

        <!-- Password -->
        <div class="space-y-2">
          <label
            for="password"
            class="block text-xs font-semibold tracking-wide text-white/55"
          >
            Mật khẩu
            <span class="text-red-400">*</span>
          </label>

          <div class="relative">
            <i class="pi pi-lock pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm text-white/35"></i>
            <p-password
              inputId="password"
              formControlName="password"
              placeholder="Nhập mật khẩu"
              autocomplete="current-password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="block w-full"
              inputStyleClass="w-full !rounded-full !border !border-white/20 !bg-white/5 !py-3 !pl-11 !pr-12 !text-sm !text-white placeholder:!text-white/35"
              [style]="{ width: '100%' }"
              [inputStyle]="{ width: '100%' }"
            />
          </div>

          @if (
            form.controls.password.touched &&
            form.controls.password.invalid
          ) {
            <small class="flex items-center gap-1 text-sm text-red-300">
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
          styleClass="w-full !rounded-full !border-0 !bg-gradient-to-r !from-emerald-400 !to-lime-400 !py-3.5 !text-sm !font-bold !text-emerald-950 !shadow-[0_12px_40px_-10px_rgba(52,211,153,0.65)] transition-all hover:!from-emerald-300 hover:!to-lime-300"
          [loading]="loading()"
          [disabled]="loading()"
        />

        <!-- Footer -->
        <div class="border-t border-white/10 pt-5 text-center">
          <p class="text-xs text-white/35">
            © 2026 Cửa hàng tiện lợi. All rights reserved.
          </p>
          <p class="mt-1 text-xs text-white/30">
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
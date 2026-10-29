import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-forbidden',
    imports: [RouterLink],
    template: `
    <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100">
      <h1 class="text-5xl font-bold text-slate-700">403</h1>
      <p class="text-slate-500">Bạn không có quyền truy cập trang này.</p>
      <a routerLink="/admin" class="text-emerald-600 hover:underline">Về trang chủ</a>
    </div>
  `,
})
export class Forbidden { }
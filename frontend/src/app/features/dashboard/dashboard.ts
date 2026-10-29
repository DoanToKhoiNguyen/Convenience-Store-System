import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABEL } from '../../core/auth/roles';

@Component({
  selector: 'app-dashboard',
  template: `
    <h1 class="text-2xl font-semibold text-slate-800">Xin chào, {{ auth.user()?.HoTen }}</h1>
    <p class="mt-1 text-slate-500">Vai trò: {{ roleName() }}</p>
  `,
})
export class Dashboard {
  protected auth = inject(AuthService);
  readonly roleName = computed(() => ROLE_LABEL[this.auth.user()?.MaVaiTro ?? 0] ?? '');
}
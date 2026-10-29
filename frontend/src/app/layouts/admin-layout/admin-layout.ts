import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE, ROLE_LABEL } from '../../core/auth/roles';

interface MenuItem {
  label: string;
  icon: string;
  link: string;
  roles?: number[]; // không khai báo = ai đăng nhập cũng thấy
}

const ALL_MENU: MenuItem[] = [
  { label: 'Tổng quan', icon: 'pi pi-home', link: '/admin' },
  { label: 'Bán hàng (POS)', icon: 'pi pi-shopping-cart', link: '/admin/sales', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Sản phẩm', icon: 'pi pi-box', link: '/admin/products' },
  { label: 'Cảnh báo kho', icon: 'pi pi-exclamation-triangle', link: '/admin/stock-alerts', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Lịch sử tồn kho', icon: 'pi pi-history', link: 'lich-su-ton-kho', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Phiếu nhập', icon: 'pi pi-truck', link: '/admin/purchases', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Nhân viên', icon: 'pi pi-users', link: '/admin/staff', roles: [ROLE.OWNER, ROLE.MANAGER] },
];

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-slate-100">
      <aside class="flex w-64 flex-col bg-slate-900 text-slate-300">
        <div class="px-5 py-4 text-lg font-semibold text-white">
          <i class="pi pi-shop mr-2 text-emerald-400"></i>Cửa hàng tiện lợi
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto px-2">
          @for (item of menu(); track item.link) {
            <a
              [routerLink]="item.link"
              routerLinkActive="bg-slate-700 text-white"
              [routerLinkActiveOptions]="{ exact: item.link === '/admin' }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="border-t border-slate-700 p-4 text-sm">
          <div class="font-medium text-white">{{ auth.user()?.HoTen }}</div>
          <div class="text-slate-400">{{ roleName() }}</div>
          <button
            type="button"
            (click)="auth.logout()"
            class="mt-3 flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <i class="pi pi-sign-out"></i> Đăng xuất
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayout {
  protected auth = inject(AuthService);

  readonly menu = computed(() =>
    ALL_MENU.filter((item) => !item.roles || this.auth.hasAnyRole(item.roles)),
  );

  readonly roleName = computed(() => ROLE_LABEL[this.auth.user()?.MaVaiTro ?? 0] ?? '');
}
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
  { label: 'Báo cáo doanh thu', icon: 'pi pi-chart-line', link: '/admin/reports', roles: [ROLE.OWNER, ROLE.MANAGER] },
  { label: 'Bán hàng (POS)', icon: 'pi pi-shopping-cart', link: '/admin/sales', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Hóa đơn', icon: 'pi pi-receipt', link: '/admin/invoices', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Khuyến mãi', icon: 'pi pi-tag', link: '/admin/promotions', roles: [ROLE.OWNER, ROLE.MANAGER] },
  { label: 'Sản phẩm', icon: 'pi pi-box', link: '/admin/products' },
  { label: 'Cập nhật tồn kho', icon: 'pi pi-sliders-h', link: '/admin/stock-update', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Cảnh báo kho', icon: 'pi pi-exclamation-triangle', link: '/admin/stock-alerts', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Lịch sử tồn kho', icon: 'pi pi-history', link: '/admin/stock-history', roles: [ROLE.OWNER, ROLE.MANAGER] },
  { label: 'Phiếu nhập', icon: 'pi pi-truck', link: '/admin/purchases', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Nhà cung cấp', icon: 'pi pi-building', link: '/admin/suppliers', roles: [ROLE.OWNER, ROLE.MANAGER] },
  { label: 'Đăng ký ca làm', icon: 'pi pi-calendar-plus', link: '/admin/shift-register', roles: [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF] },
  { label: 'Thời khóa biểu', icon: 'pi pi-calendar', link: '/admin/timetable', roles: [ROLE.OWNER, ROLE.MANAGER] },
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
  <a
    routerLink="/admin/profile"
    class="-m-2 block rounded-lg p-2 hover:bg-slate-800"
  >
    <div class="font-medium text-white">{{ auth.user()?.HoTen }}</div>
    <div class="text-slate-400">{{ roleName() }}</div>
    <div class="mt-1 text-xs text-emerald-400">
      <i class="pi pi-user-edit mr-1"></i>Thông tin cá nhân
    </div>
  </a>
  <button
    type="button"
    (click)="auth.logout()"
    class="mt-4 flex items-center gap-2 text-slate-300 hover:text-white"
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
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE, ROLE_LABEL } from '../../core/auth/roles';

interface MenuItem {
  label: string;
  icon: string;
  link: string;
  roles?: number[]; // không khai báo = ai đăng nhập cũng thấy
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const ALL = [ROLE.OWNER, ROLE.MANAGER, ROLE.STAFF];
const MANAGERS = [ROLE.OWNER, ROLE.MANAGER];

// Muốn đổi thứ tự hoặc chuyển mục sang nhóm khác thì sửa ở đây
const GROUPS: MenuGroup[] = [
  {
    title: 'Bán hàng',
    items: [
      { label: 'Bán hàng (POS)', icon: 'pi pi-shopping-cart', link: '/admin/sales', roles: ALL },
      { label: 'Hóa đơn', icon: 'pi pi-receipt', link: '/admin/invoices', roles: ALL },
      { label: 'Khuyến mãi', icon: 'pi pi-tag', link: '/admin/promotions', roles: MANAGERS },
    ],
  },
  {
    title: 'Kho hàng',
    items: [
      { label: 'Sản phẩm', icon: 'pi pi-box', link: '/admin/products' },
      { label: 'Danh mục', icon: 'pi pi-tags', link: '/admin/categories', roles: MANAGERS },
      { label: 'Cập nhật tồn kho', icon: 'pi pi-sliders-h', link: '/admin/stock-update', roles: ALL },
      { label: 'Cảnh báo kho', icon: 'pi pi-exclamation-triangle', link: '/admin/stock-alerts', roles: ALL },
      { label: 'Lịch sử tồn kho', icon: 'pi pi-history', link: '/admin/stock-history', roles: MANAGERS },
      { label: 'Phiếu nhập', icon: 'pi pi-truck', link: '/admin/purchases', roles: ALL },
      { label: 'Nhà cung cấp', icon: 'pi pi-building', link: '/admin/suppliers', roles: MANAGERS },
    ],
  },
  {
    title: 'Nhân sự',
    items: [
      { label: 'Thời khóa biểu', icon: 'pi pi-calendar', link: '/admin/timetable', roles: MANAGERS },
      { label: 'Đăng ký ca làm', icon: 'pi pi-calendar-plus', link: '/admin/shift-register', roles: ALL },
      { label: 'Nhân viên', icon: 'pi pi-users', link: '/admin/staff', roles: MANAGERS },
    ],
  },
  {
    title: 'Báo cáo',
    items: [{ label: 'Báo cáo doanh thu', icon: 'pi pi-chart-line', link: '/admin/reports', roles: MANAGERS }],
  },
];

const COLLAPSE_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: {
    '(document:click)': 'userMenuOpen.set(false)',
    '(document:keydown.escape)': 'closeAll()',
  },
  template: `
    <div class="flex h-screen bg-slate-100">
      <!-- Lớp phủ khi mở menu trên điện thoại -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" (click)="mobileOpen.set(false)"></div>
      }

      <!-- Thanh bên -->
      <aside [class]="asideClass()">
        <div class="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <i class="pi pi-shop"></i>
          </span>
          <div [class]="collapsed() ? 'min-w-0 lg:hidden' : 'min-w-0'">
            <div class="truncate text-sm font-semibold leading-4 text-white">Cửa hàng tiện lợi</div>
            <div class="truncate text-xs text-slate-400">Quản lý cửa hàng</div>
          </div>
          <button
            type="button"
            class="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Đóng menu"
            (click)="mobileOpen.set(false)"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 pb-4 text-slate-300 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
          @for (g of groups(); track g.title; let first = $first) {
            @if (!first) {
              <div [class]="collapsed() ? 'mx-3 my-3 hidden border-t border-white/10 lg:block' : 'hidden'"></div>
            }
            <div
              [class]="'px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ' + (collapsed() ? 'lg:hidden' : '')"
            >
              {{ g.title }}
            </div>

            @for (item of g.items; track item.link) {
              <a
                [routerLink]="item.link"
                routerLinkActive="bg-emerald-500/15 text-white"
                #rla="routerLinkActive"
                [title]="item.label"
                class="group relative my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/5 hover:text-white"
              >
                <span
                  class="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-emerald-400"
                  [class.hidden]="!rla.isActive"
                ></span>
                <i [class]="item.icon + ' w-5 shrink-0 text-center text-base'" [class.text-emerald-400]="rla.isActive"></i>
                <span [class]="collapsed() ? 'truncate lg:hidden' : 'truncate'">{{ item.label }}</span>
              </a>
            }
          }
        </nav>
      </aside>

      <!-- Phần bên phải -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-5">
          <button
            type="button"
            class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu"
            (click)="mobileOpen.set(true)"
          >
            <i class="pi pi-bars"></i>
          </button>
          <button
            type="button"
            class="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:inline-flex"
            [attr.aria-label]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
            [title]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
            (click)="toggleCollapsed()"
          >
            <i class="pi pi-bars"></i>
          </button>

          <nav class="min-w-0 truncate text-sm text-slate-500" aria-label="Vị trí hiện tại">
            @if (current(); as c) {
              <span class="hidden sm:inline">{{ c.group }}</span>
              <i class="pi pi-angle-right mx-1 hidden text-xs sm:inline"></i>
              <span class="font-medium text-slate-800">{{ c.label }}</span>
            }
          </nav>

          <div class="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              routerLink="/"
              target="_blank"
              class="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-emerald-700 sm:inline-flex"
              title="Mở trang khách xem sản phẩm"
            >
              <i class="pi pi-external-link text-xs"></i> Trang khách
            </a>

            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 sm:pr-3"
                aria-haspopup="menu"
                [attr.aria-expanded]="userMenuOpen()"
                (click)="toggleUserMenu($event)"
              >
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                  {{ initials() }}
                </span>
                <span class="hidden text-left sm:block">
                  <span class="block text-sm font-medium leading-4 text-slate-800">{{ auth.user()?.HoTen }}</span>
                  <span class="block text-xs text-slate-500">{{ roleName() }}</span>
                </span>
                <i class="pi pi-angle-down hidden text-xs text-slate-400 sm:inline"></i>
              </button>

              @if (userMenuOpen()) {
                <div
                  class="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  role="menu"
                  (click)="$event.stopPropagation()"
                >
                  <div class="border-b border-slate-100 px-4 py-3">
                    <div class="truncate text-sm font-medium text-slate-800">{{ auth.user()?.HoTen }}</div>
                    <div class="truncate text-xs text-slate-500">{{ roleName() }}</div>
                  </div>
                  <a
                    routerLink="/admin/profile"
                    role="menuitem"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <i class="pi pi-user-edit text-slate-400"></i> Thông tin cá nhân
                  </a>
                  <a
                    routerLink="/"
                    target="_blank"
                    role="menuitem"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 sm:hidden"
                  >
                    <i class="pi pi-external-link text-slate-400"></i> Trang khách
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                    (click)="auth.logout()"
                  >
                    <i class="pi pi-sign-out"></i> Đăng xuất
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 sm:p-6">
          <div class="mx-auto w-full max-w-[90rem]">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected auth = inject(AuthService);
  private router = inject(Router);

  readonly collapsed = signal(readCollapsed());
  readonly mobileOpen = signal(false);
  readonly userMenuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly groups = computed(() =>
    GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.roles || this.auth.hasAnyRole(i.roles)),
    })).filter((g) => g.items.length > 0),
  );

  readonly roleName = computed(() => ROLE_LABEL[this.auth.user()?.MaVaiTro ?? 0] ?? '');

  readonly initials = computed(() => {
    const parts = (this.auth.user()?.HoTen ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const text = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
    return text.toUpperCase();
  });

  // Tên trang hiện tại để hiện ở thanh trên cùng
  readonly current = computed(() => {
    const url = this.url().split(/[?#]/)[0];
    for (const g of this.groups()) {
      for (const i of g.items) {
        if (url === i.link || url.startsWith(i.link + '/')) return { group: g.title, label: i.label };
      }
    }
    if (url.startsWith('/admin/profile')) return { group: 'Tài khoản', label: 'Thông tin cá nhân' };
    return null;
  });

  readonly asideClass = computed(
    () =>
      'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 shadow-xl transition-all duration-200 ' +
      (this.mobileOpen() ? 'translate-x-0 ' : '-translate-x-full ') +
      'lg:static lg:translate-x-0 lg:shadow-none ' +
      (this.collapsed() ? 'lg:w-[4.5rem]' : 'lg:w-64'),
  );

  constructor() {
    // Chuyển trang thì đóng menu điện thoại và menu người dùng
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeAll());
  }

  toggleCollapsed() {
    this.collapsed.update((v) => !v);
    try {
      localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
    } catch {
      // trình duyệt chặn localStorage thì bỏ qua, chỉ không nhớ lựa chọn
    }
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  closeAll() {
    this.mobileOpen.set(false);
    this.userMenuOpen.set(false);
  }
}
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE, ROLE_LABEL } from '../../core/auth/roles';
import { NoticeService } from '../../core/ui/notice.service';

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
    <div class="flex h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/40">
      <!-- Lớp phủ khi mở menu trên điện thoại -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden" (click)="mobileOpen.set(false)"></div>
      }

      <!-- Thanh bên -->
      <aside [class]="asideClass()">
        <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950">
          <!-- Ánh sáng trang trí -->
          <div class="pointer-events-none absolute inset-0">
            <div class="absolute -left-12 top-8 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl"></div>
            <div class="absolute -right-16 bottom-12 h-52 w-52 rounded-full bg-teal-400/10 blur-3xl"></div>
          </div>

          <div class="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/20">
              <i class="pi pi-shop text-lg"></i>
            </span>
            <div [class]="collapsed() ? 'min-w-0 lg:hidden' : 'min-w-0'">
              <div class="truncate text-sm font-semibold leading-4 text-white">Cửa hàng tiện lợi</div>
              <div class="truncate text-xs text-slate-400">Quản lý cửa hàng</div>
            </div>
            <button
              type="button"
              class="ml-auto rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Đóng menu"
              (click)="mobileOpen.set(false)"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <nav class="relative flex-1 overflow-y-auto px-2.5 pb-5 text-slate-300 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
            @for (g of groups(); track g.title; let first = $first) {
              @if (!first) {
                <div [class]="collapsed() ? 'mx-3 my-3 hidden border-t border-white/10 lg:block' : 'hidden'"></div>
              }
              <div
                [class]="'px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 ' + (collapsed() ? 'lg:hidden' : '')"
              >
                {{ g.title }}
              </div>

              @for (item of g.items; track item.link) {
                <a
                  [routerLink]="item.link"
                  routerLinkActive="bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent text-white ring-1 ring-emerald-400/20"
                  #rla="routerLinkActive"
                  [title]="item.label"
                  [class]="'group relative my-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 hover:bg-white/5 hover:text-white' + (collapsed() ? ' lg:justify-center lg:px-0' : '')"
                >
                  <span
                    class="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                    [class.hidden]="!rla.isActive"
                  ></span>
                  <i
                    [class]="item.icon + ' w-5 shrink-0 text-center text-[15px] transition-colors'"
                    [class.text-emerald-300]="rla.isActive"
                    [class.text-slate-400]="!rla.isActive"
                  ></i>
                  <span [class]="collapsed() ? 'truncate lg:hidden' : 'truncate'">{{ item.label }}</span>

                  @if (coMoi(item.link) ? badgeCount(item.link) : 0; as n) {
                    <span
                      [class]="badgeClass()"
                      [attr.aria-label]="badgeLabel(item.link, n)"
                      [title]="badgeLabel(item.link, n)"
                    >
                      <i class="pi pi-bell text-[9px]" [class]="collapsed() ? 'lg:hidden' : ''"></i>
                      <span [class]="collapsed() ? 'lg:hidden' : ''">{{ n }}</span>
                    </span>
                  }
                </a>
              }
            }
          </nav>
        </div>
      </aside>

      <!-- Phần bên phải -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200/70 bg-white/80 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            class="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Mở menu"
            (click)="mobileOpen.set(true)"
          >
            <i class="pi pi-bars"></i>
          </button>
          <button
            type="button"
            class="hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            [attr.aria-label]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
            [title]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
            (click)="toggleCollapsed()"
          >
            <i class="pi pi-bars"></i>
          </button>

          <nav class="ml-1 min-w-0 truncate text-sm text-slate-500" aria-label="Vị trí hiện tại">
            @if (current(); as c) {
              <span class="hidden items-center gap-1.5 sm:inline-flex">
                <i class="pi pi-home text-[11px] text-slate-400"></i>
                <span>{{ c.group }}</span>
              </span>
              <i class="pi pi-angle-right mx-1.5 hidden text-[10px] text-slate-300 sm:inline"></i>
              <span class="font-semibold text-slate-800">{{ c.label }}</span>
            }
          </nav>

          <div class="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              routerLink="/"
              target="_blank"
              class="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:inline-flex"
              title="Mở trang khách xem sản phẩm"
            >
              <i class="pi pi-external-link text-xs"></i> Trang khách
            </a>

            <span class="mx-1 hidden h-6 w-px bg-slate-200 sm:block"></span>

            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1.5 transition hover:bg-slate-100 sm:pr-3"
                aria-haspopup="menu"
                [attr.aria-expanded]="userMenuOpen()"
                (click)="toggleUserMenu($event)"
              >
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 ring-2 ring-white">
                  {{ initials() }}
                </span>
                <span class="hidden text-left sm:block">
                  <span class="block text-sm font-medium leading-4 text-slate-800">{{ auth.user()?.HoTen }}</span>
                  <span class="block text-xs text-slate-500">{{ roleName() }}</span>
                </span>
                <i class="pi pi-angle-down hidden text-xs text-slate-400 transition-transform sm:inline" [class.rotate-180]="userMenuOpen()"></i>
              </button>

              @if (userMenuOpen()) {
                <div
                  class="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
                  role="menu"
                  (click)="$event.stopPropagation()"
                >
                  <div class="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                      {{ initials() }}
                    </span>
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold text-slate-800">{{ auth.user()?.HoTen }}</div>
                      <div class="truncate text-xs text-slate-500">{{ roleName() }}</div>
                    </div>
                  </div>

                  <div class="p-1.5">
                    <a
                      routerLink="/admin/profile"
                      role="menuitem"
                      class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-emerald-100 group-hover:text-emerald-600">
                        <i class="pi pi-user-edit text-xs"></i>
                      </span>
                      Thông tin cá nhân
                    </a>
                    <a
                      routerLink="/"
                      target="_blank"
                      role="menuitem"
                      class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 sm:hidden"
                    >
                      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-emerald-100 group-hover:text-emerald-600">
                        <i class="pi pi-external-link text-xs"></i>
                      </span>
                      Trang khách
                    </a>
                  </div>

                  <div class="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                      (click)="auth.logout()"
                    >
                      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                        <i class="pi pi-sign-out text-xs"></i>
                      </span>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 sm:p-6">
          <div class="w-full">
            <router-outlet />
          </div>
        </main>
      </div>

      <!-- Thông báo nổi khi có việc mới -->
      @if (notice.thongBaoMoi(); as tb) {
        <div
          class="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-xl shadow-slate-900/10"
          role="status"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <i class="pi pi-bell text-sm"></i>
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-slate-800">Thông báo mới</div>
            <p class="mt-0.5 text-sm text-slate-600">{{ tb }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng thông báo"
            (click)="notice.anThongBao()"
          >
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class AdminLayout {
  protected auth = inject(AuthService);
  private router = inject(Router);
  protected notice = inject(NoticeService);

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

  // Badge chỉ hiện khi có việc CHƯA XEM; xem rồi thì ẩn cả chấm lẫn số
  private readonly badges = computed<Record<string, number>>(() => ({
    '/admin/stock-alerts': this.notice.canhBaoKho() + this.notice.loSapHetHan(),
    '/admin/purchases': this.notice.phieuChoDuyet() + this.notice.phieuChoNhan(),
  }));

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
    // Chuyển trang thì đóng menu điện thoại, menu người dùng và làm mới chấm báo
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.closeAll();
        this.danhDauDaXem(e.urlAfterRedirects);
        this.notice.refresh();
      });
  }

  // Chỉ cảnh báo lô sắp hết hạn mới "xem là tắt": badge giữ số, ẩn chuông.
  // Cảnh báo kho tắt khi lập phiếu nhập, phiếu nhập tắt khi đã nhận hàng, nên không đánh dấu ở đây.
  private danhDauDaXem(url: string) {
    const u = url.split(/[?#]/)[0];
    if (u.startsWith('/admin/expiry-alerts')) this.notice.xemKenh('han');
  }

  coMoi(link: string): boolean {
    if (link === '/admin/stock-alerts') return this.notice.moiKho() || this.notice.moiHan();
    if (link === '/admin/purchases') return this.notice.moiMua();
    return false;
  }

  badgeCount(link: string): number {
    return this.badges()[link] ?? 0;
  }

  badgeClass(): string {
    const base =
      'ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm shadow-red-500/40';
    return this.collapsed()
      ? base + ' lg:absolute lg:right-1 lg:top-1 lg:ml-0 lg:h-2.5 lg:min-w-2.5 lg:gap-0 lg:px-0'
      : base;
  }

  badgeLabel(link: string, n: number): string {
    if (link === '/admin/stock-alerts') {
      const parts: string[] = [];
      const kho = this.notice.canhBaoKho();
      if (kho > 0) {
        const coPhieu = this.notice.canhBaoKhoTong() - kho;
        parts.push(
          coPhieu > 0
            ? `${kho} sản phẩm cần nhập thêm (${coPhieu} đã có phiếu nhập)`
            : `${kho} sản phẩm cần nhập thêm`,
        );
      }
      const han = this.notice.loSapHetHan();
      if (han > 0) parts.push(`${han} lô hàng sắp hết hạn`);
      return parts.join(' · ') || String(n);
    }
    if (link === '/admin/purchases') {
      const parts: string[] = [];
      const duyet = this.notice.phieuChoDuyet();
      const nhan = this.notice.phieuChoNhan();
      if (duyet > 0) parts.push(`${duyet} phiếu chờ duyệt`);
      if (nhan > 0) parts.push(`${nhan} phiếu chờ nhận hàng`);
      return parts.join(' · ') || String(n);
    }
    return String(n);
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
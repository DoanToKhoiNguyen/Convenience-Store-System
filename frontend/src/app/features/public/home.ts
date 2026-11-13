import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from '../../core/auth/auth.service';
import { PublicProduct } from './public.model';
import { PublicService } from './public.service';

type Sort = 'ten' | 'gia_tang' | 'gia_giam';

const PAGE_SIZE = 12;
const OTHER = 'Khác';

// Màu nền cho sản phẩm chưa có ảnh
const COLORS = [
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
    'bg-teal-100 text-teal-700',
];

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const categoryOf = (p: PublicProduct) => p.LoaiSanPham?.trim() || OTHER;

@Component({
    selector: 'app-public-home',
    imports: [DecimalPipe, RouterLink, DialogModule],
    template: `
    <div class="min-h-screen bg-slate-50 text-slate-800">
      <!-- Thanh trên cùng -->
      <header class="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <a routerLink="/" class="flex shrink-0 items-center gap-2 text-lg font-semibold text-slate-800">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <i class="pi pi-shop"></i>
            </span>
            <span class="hidden sm:inline">Cửa hàng tiện lợi</span>
          </a>

          <div class="relative flex-1">
            <i class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="search"
              placeholder="Tìm sản phẩm, ví dụ: nuoc ngot, mi goi, sua..."
              class="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
              [value]="keyword()"
              (input)="onSearch($any($event.target).value)"
            />
          </div>
        </div>
      </header>

      <!-- Giới thiệu -->
      <section class="text-white" style="background-image: linear-gradient(135deg, #047857, #10b981)">
        <div class="mx-auto max-w-7xl px-4 py-8 sm:py-12">
          <h1 class="text-2xl font-bold sm:text-4xl">Sản phẩm tại cửa hàng</h1>
          <p class="mt-2 max-w-2xl text-emerald-50">
            Xem giá và tình trạng hàng trước khi ghé cửa hàng. Trang này chỉ dùng để xem thông tin,
            vui lòng mua trực tiếp tại quầy.
          </p>
          @if (!loading() && !error()) {
            <p class="mt-3 text-sm text-emerald-100">{{ products().length }} sản phẩm đang bán</p>
          }
        </div>
      </section>

      <main class="mx-auto max-w-7xl px-4 py-6">
        <!-- Loại sản phẩm -->
        @if (categories().length > 1) {
          <div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
            <button
              type="button"
              class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium"
              [class]="category() === null
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'"
              (click)="onCategory(null)"
            >
              Tất cả ({{ base().length }})
            </button>
            @for (c of categories(); track c.name) {
              <button
                type="button"
                class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium"
                [class]="category() === c.name
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'"
                (click)="onCategory(c.name)"
              >
                {{ c.name }} ({{ c.count }})
              </button>
            }
          </div>
        }

        <!-- Sắp xếp và bộ lọc -->
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500">
            @if (!loading()) { Hiển thị <b class="text-slate-700">{{ filtered().length }}</b> sản phẩm }
          </p>

          <div class="flex flex-wrap items-center gap-4 text-sm">
            <label class="flex cursor-pointer items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                class="h-4 w-4 accent-emerald-600"
                [checked]="inStockOnly()"
                (change)="onStock($any($event.target).checked)"
              />
              Chỉ hiện sản phẩm còn hàng
            </label>

            <label class="flex items-center gap-2 text-slate-600">
              Sắp xếp
              <select
                class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-emerald-500 focus:outline-none"
                (change)="onSort($any($event.target).value)"
              >
                @for (o of sortOptions; track o.key) {
                  <option [value]="o.key" [selected]="sort() === o.key">{{ o.label }}</option>
                }
              </select>
            </label>
          </div>
        </div>

        @if (error()) {
          <div class="rounded-xl bg-white p-10 text-center shadow-sm">
            <i class="pi pi-exclamation-circle mb-3 text-3xl text-red-500"></i>
            <p class="text-slate-700">{{ error() }}</p>
            <button
              type="button"
              class="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              (click)="load()"
            >
              Thử lại
            </button>
          </div>
        } @else if (loading()) {
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            @for (i of skeleton; track i) {
              <div class="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
                <div class="aspect-square bg-slate-200"></div>
                <div class="space-y-2 p-3">
                  <div class="h-3 w-1/3 rounded bg-slate-200"></div>
                  <div class="h-4 w-4/5 rounded bg-slate-200"></div>
                  <div class="h-5 w-1/2 rounded bg-slate-200"></div>
                </div>
              </div>
            }
          </div>
        } @else if (filtered().length === 0) {
          <div class="rounded-xl bg-white p-10 text-center shadow-sm">
            <i class="pi pi-search mb-3 text-3xl text-slate-300"></i>
            @if (products().length === 0) {
              <p class="text-slate-600">Hiện chưa có sản phẩm nào để hiển thị.</p>
            } @else {
              <p class="text-slate-600">Không tìm thấy sản phẩm phù hợp.</p>
              <button type="button" class="mt-3 text-sm text-emerald-600 underline" (click)="clearFilters()">
                Xóa bộ lọc
              </button>
            }
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            @for (p of visible(); track p.MaSanPham) {
              <button
                type="button"
                class="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                (click)="selected.set(p)"
              >
                <div class="relative aspect-square overflow-hidden bg-slate-100">
                  @if (showImage(p)) {
                    <img
                      [src]="p.hinh_anh_url"
                      [alt]="p.TenSanPham"
                      loading="lazy"
                      class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      [class.opacity-50]="!p.con_hang"
                      [class.grayscale]="!p.con_hang"
                      (error)="markFailed(p)"
                    />
                  } @else {
                    <div
                      class="flex h-full w-full items-center justify-center text-5xl font-bold"
                      [class]="color(p)"
                      [class.opacity-60]="!p.con_hang"
                    >
                      {{ initial(p) }}
                    </div>
                  }
                  @if (!p.con_hang) {
                    <span class="absolute left-2 top-2 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-white">
                      Hết hàng
                    </span>
                  }
                </div>

                <div class="flex flex-1 flex-col p-3">
                  <div class="truncate text-xs text-slate-500">{{ p.TenThuongHieu || categoryName(p) }}</div>
                  <h3 class="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-slate-800">
                    {{ p.TenSanPham }}
                  </h3>
                  <div class="mt-2 flex items-end justify-between gap-2">
                    <span class="text-lg font-bold text-emerald-600">{{ price(p) | number: '1.0-0' }} ₫</span>
                    <span class="text-xs" [class]="p.con_hang ? 'text-emerald-600' : 'text-slate-400'">
                      {{ p.con_hang ? 'Còn hàng' : 'Hết hàng' }}
                    </span>
                  </div>
                </div>
              </button>
            }
          </div>

          @if (hasMore()) {
            <div class="mt-8 text-center">
              <button
                type="button"
                class="rounded-full border border-emerald-600 px-6 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                (click)="loadMore()"
              >
                Xem thêm {{ remaining() }} sản phẩm
              </button>
            </div>
          }
        }
      </main>

      <footer class="mt-10 border-t border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500">
          <span>© {{ year }} Cửa hàng tiện lợi. Giá và tình trạng hàng có thể thay đổi.</span>
          @if (auth.isLoggedIn()) {
            <a routerLink="/admin" class="hover:text-emerald-600 hover:underline">Vào trang quản lý</a>
          } @else {
            <a routerLink="/login" class="hover:text-emerald-600 hover:underline">Dành cho nhân viên</a>
          }
        </div>
      </footer>
    </div>

    <!-- Chi tiết sản phẩm (chỉ xem) -->
    <p-dialog
      [modal]="true"
      [dismissableMask]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [header]="selected()?.TenSanPham ?? ''"
      [style]="{ width: 'min(34rem, 94vw)' }"
    >
      @if (selected(); as p) {
        <div class="space-y-4">
          <div class="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
            @if (showImage(p)) {
              <img [src]="p.hinh_anh_url" [alt]="p.TenSanPham" class="h-full w-full object-contain" (error)="markFailed(p)" />
            } @else {
              <div class="flex h-full w-full items-center justify-center text-7xl font-bold" [class]="color(p)">
                {{ initial(p) }}
              </div>
            }
          </div>

          <div class="flex items-end justify-between gap-3">
            <div class="text-3xl font-bold text-emerald-600">{{ price(p) | number: '1.0-0' }} ₫</div>
            <span
              class="rounded-full px-3 py-1 text-sm font-medium"
              [class]="p.con_hang ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
            >
              {{ p.con_hang ? 'Còn hàng' : 'Hết hàng' }}
            </span>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-slate-500">Loại</dt>
              <dd class="font-medium text-slate-800">{{ categoryName(p) }}</dd>
            </div>
            <div>
              <dt class="text-slate-500">Thương hiệu</dt>
              <dd class="font-medium text-slate-800">{{ p.TenThuongHieu || '—' }}</dd>
            </div>
          </dl>

          @if (p.MoTa) {
            <div>
              <h4 class="mb-1 text-sm font-medium text-slate-700">Mô tả</h4>
              <p class="text-sm text-slate-600">{{ p.MoTa }}</p>
            </div>
          }
          @if (p.ThanhPhan) {
            <div>
              <h4 class="mb-1 text-sm font-medium text-slate-700">Thành phần</h4>
              <p class="text-sm text-slate-600">{{ p.ThanhPhan }}</p>
            </div>
          }

          <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Trang này chỉ dùng để xem thông tin. Vui lòng mua trực tiếp tại cửa hàng.
          </p>
        </div>
      }
    </p-dialog>
  `,
})
export class PublicHome {
    private service = inject(PublicService);
    protected auth = inject(AuthService);

    readonly year = new Date().getFullYear();
    readonly skeleton = Array.from({ length: 10 }, (_, i) => i);
    readonly sortOptions: { key: Sort; label: string }[] = [
        { key: 'ten', label: 'Tên A → Z' },
        { key: 'gia_tang', label: 'Giá thấp → cao' },
        { key: 'gia_giam', label: 'Giá cao → thấp' },
    ];

    readonly products = signal<PublicProduct[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);

    readonly keyword = signal('');
    readonly category = signal<string | null>(null);
    readonly sort = signal<Sort>('ten');
    readonly inStockOnly = signal(false);
    readonly shown = signal(PAGE_SIZE);
    readonly selected = signal<PublicProduct | null>(null);
    private readonly failed = signal<Set<number>>(new Set());

    // Đã lọc theo từ khóa và tình trạng hàng, chưa lọc theo loại (để đếm số lượng mỗi loại)
    readonly base = computed(() => {
        const words = normalize(this.keyword().trim()).split(/\s+/).filter(Boolean);
        return this.products().filter((p) => {
            if (this.inStockOnly() && !p.con_hang) return false;
            if (words.length === 0) return true;
            const text = normalize(`${p.TenSanPham} ${p.TenThuongHieu ?? ''} ${p.LoaiSanPham ?? ''}`);
            return words.every((w) => text.includes(w));
        });
    });

    readonly categories = computed(() => {
        const counts = new Map<string, number>();
        for (const p of this.products()) counts.set(categoryOf(p), 0);
        for (const p of this.base()) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1);

        return [...counts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) =>
                a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name.localeCompare(b.name, 'vi'),
            );
    });

    readonly filtered = computed(() => {
        const cat = this.category();
        const list = this.base().filter((p) => !cat || categoryOf(p) === cat);
        const sort = this.sort();

        return [...list].sort((a, b) =>
            sort === 'gia_tang'
                ? this.price(a) - this.price(b)
                : sort === 'gia_giam'
                    ? this.price(b) - this.price(a)
                    : a.TenSanPham.localeCompare(b.TenSanPham, 'vi'),
        );
    });

    readonly visible = computed(() => this.filtered().slice(0, this.shown()));
    readonly hasMore = computed(() => this.filtered().length > this.shown());
    readonly remaining = computed(() => this.filtered().length - this.shown());

    constructor() {
        inject(Title).setTitle('Cửa hàng tiện lợi - Sản phẩm');
        this.load();
    }

    load() {
        this.loading.set(true);
        this.error.set(null);
        this.service.products().subscribe({
            next: (data) => {
                this.products.set(data);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.error.set('Không tải được danh sách sản phẩm. Vui lòng thử lại sau.');
            },
        });
    }

    price(p: PublicProduct): number {
        return Number(p.DonGiaBan);
    }

    categoryName(p: PublicProduct): string {
        return categoryOf(p);
    }

    initial(p: PublicProduct): string {
        return (p.TenSanPham.trim().charAt(0) || '?').toUpperCase();
    }

    color(p: PublicProduct): string {
        return COLORS[Math.abs(Number(p.MaSanPham) || 0) % COLORS.length];
    }

    showImage(p: PublicProduct): boolean {
        return !!p.hinh_anh_url && !this.failed().has(p.MaSanPham);
    }

    markFailed(p: PublicProduct) {
        this.failed.update((s) => new Set(s).add(p.MaSanPham));
    }

    onSearch(v: string) {
        this.keyword.set(v);
        this.shown.set(PAGE_SIZE);
    }

    onCategory(name: string | null) {
        this.category.set(name);
        this.shown.set(PAGE_SIZE);
    }

    onSort(v: string) {
        this.sort.set(v as Sort);
        this.shown.set(PAGE_SIZE);
    }

    onStock(checked: boolean) {
        this.inStockOnly.set(checked);
        this.shown.set(PAGE_SIZE);
    }

    clearFilters() {
        this.keyword.set('');
        this.category.set(null);
        this.inStockOnly.set(false);
        this.shown.set(PAGE_SIZE);
    }

    loadMore() {
        this.shown.update((n) => n + PAGE_SIZE);
    }
}
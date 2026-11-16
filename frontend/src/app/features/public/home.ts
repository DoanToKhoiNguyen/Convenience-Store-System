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

// Thông tin cửa hàng: điền vào đây, chỗ nào để trống thì trang tự ẩn đi (không hiện thông tin giả)
const STORE = {
  address: '',
  hotline: '',
  email: '',
  social: { facebook: '', instagram: '', youtube: '' },
};

// Màu nền cho sản phẩm chưa có ảnh
const COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

// Màu nền nhẹ cho biểu tượng danh mục
const CAT_TONES = ['bg-emerald-50', 'bg-sky-50', 'bg-amber-50', 'bg-rose-50', 'bg-violet-50', 'bg-teal-50'];

// Biểu tượng theo từ khóa trong tên danh mục (danh mục lấy từ dữ liệu thật, chỉ biểu tượng là chọn theo tên)
const CATEGORY_ICONS: { keys: string[]; icon: string }[] = [
  { keys: ['sua'], icon: '🥛' },
  { keys: ['uong', 'nuoc', 'giai khat', 'tra', 'ca phe'], icon: '🥤' },
  { keys: ['banh', 'keo'], icon: '🍬' },
  { keys: ['an vat', 'snack'], icon: '🍿' },
  { keys: ['thuc pham nhanh', 'an lien', 'nhanh'], icon: '🌭' },
  { keys: ['mi', 'thuc pham', 'kho', 'gao', 'gia vi'], icon: '🍜' },
  { keys: ['rau', 'trai cay', 'hoa qua'], icon: '🥬' },
  { keys: ['thit', 'hai san'], icon: '🥩' },
  { keys: ['kem', 'dong lanh'], icon: '🍦' },
  { keys: ['gia dung', 'dien', 'pin'], icon: '🧺' },
  { keys: ['ve sinh', 'cham soc', 'my pham'], icon: '🧴' },
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
      <!-- Thanh thông báo -->
      <div class="bg-emerald-800 text-emerald-50">
        <div class="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-1.5 text-xs sm:justify-between">
          <span class="flex items-center gap-1.5">
            <i class="pi pi-shop"></i> Xem giá và tình trạng hàng trước khi ghé cửa hàng
          </span>
          <span class="hidden sm:inline">Mua trực tiếp tại quầy · Giá có thể thay đổi</span>
        </div>
      </div>

      <!-- Thanh trên cùng -->
      <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6">
          <a routerLink="/" class="flex shrink-0 items-center gap-2.5">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <i class="pi pi-shop text-lg"></i>
            </span>
            <span class="hidden leading-4 sm:block">
              <span class="block text-lg font-bold text-slate-800">Cửa hàng tiện lợi</span>
              <span class="block text-[11px] font-medium uppercase tracking-wider text-emerald-600">Convenience Store</span>
            </span>
          </a>

          <div class="relative min-w-0 flex-1 lg:mx-auto lg:max-w-2xl">
            <i class="pi pi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="search"
              placeholder="Tìm sản phẩm, ví dụ: nuoc ngot, mi goi, sua..."
              class="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
              [value]="keyword()"
              (input)="onSearch($any($event.target).value)"
            />
          </div>

          <div class="hidden shrink-0 items-center lg:flex">
            @if (store.hotline) {
              <a
                [href]="'tel:' + store.hotline"
                class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 transition hover:bg-emerald-50"
              >
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <i class="pi pi-phone"></i>
                </span>
                <span class="leading-4">
                  <span class="block text-xs text-slate-500">Hotline hỗ trợ</span>
                  <span class="block text-sm font-semibold text-slate-800">{{ store.hotline }}</span>
                </span>
              </a>
            } @else {
              <div class="flex items-center gap-2.5 py-1 pl-1 pr-2">
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <i class="pi pi-shopping-bag"></i>
                </span>
                <span class="leading-4">
                  <span class="block text-xs text-slate-500">Mua hàng</span>
                  <span class="block text-sm font-semibold text-slate-800">Trực tiếp tại cửa hàng</span>
                </span>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- Banner giới thiệu -->
      <section
        class="relative overflow-hidden text-white"
        style="background-image: linear-gradient(135deg, #047857 0%, #10b981 55%, #6ee7b7 100%)"
      >
        <div class="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10"></div>
        <div class="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-white/10"></div>

        <div class="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 md:grid-cols-2 lg:py-16">
          <div>
            <span class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
              <i class="pi pi-shop"></i> Cửa hàng tiện lợi
            </span>
            <h1 class="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              Mua sắm tiện lợi <span class="text-emerald-100">mỗi ngày</span>
            </h1>
            <p class="mt-4 max-w-xl text-base text-emerald-50 sm:text-lg">
              Đồ uống, thực phẩm, bánh kẹo và nhiều mặt hàng thiết yếu khác. Xem giá và tình trạng hàng ngay tại đây
              trước khi ghé cửa hàng.
            </p>

            <div class="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                (click)="productsEl.scrollIntoView({ behavior: 'smooth' })"
              >
                Khám phá sản phẩm <i class="pi pi-arrow-down text-xs"></i>
              </button>

              @if (!loading() && !error()) {
                <span class="text-sm text-emerald-50">
                  {{ products().length }} sản phẩm · {{ categories().length }} danh mục
                </span>
              }
            </div>
          </div>

          <!-- Hình minh họa -->
          <div class="relative mx-auto h-52 w-full max-w-sm sm:h-64 md:h-72 lg:h-80" aria-hidden="true">
            <div class="absolute inset-4 rounded-full bg-white/15"></div>
            <div class="absolute inset-12 rounded-full bg-white/10"></div>

            <div class="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-2xl sm:h-28 sm:w-28 sm:text-6xl">
              🛒
            </div>
            <div class="absolute left-[4%] top-[6%] flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white text-3xl shadow-xl sm:h-20 sm:w-20 sm:text-4xl">
              🥤
            </div>
            <div class="absolute right-[4%] top-[10%] flex h-16 w-16 rotate-6 items-center justify-center rounded-2xl bg-white text-3xl shadow-xl sm:h-20 sm:w-20 sm:text-4xl">
              🍜
            </div>
            <div class="absolute bottom-[8%] left-[8%] flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-white text-3xl shadow-xl sm:h-20 sm:w-20 sm:text-4xl">
              🍪
            </div>
            <div class="absolute bottom-[6%] right-[6%] flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl bg-white text-3xl shadow-xl sm:h-20 sm:w-20 sm:text-4xl">
              🧃
            </div>
          </div>
        </div>
      </section>

      <main class="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <!-- Danh mục -->
        @if (loading() || categories().length > 1) {
          <section class="mb-10">
            <div class="mb-4">
              <h2 class="text-xl font-bold text-slate-800 sm:text-2xl">Khám phá danh mục</h2>
              <p class="mt-1 text-sm text-slate-500">Chọn một danh mục để xem nhanh các sản phẩm cùng loại.</p>
            </div>

            @if (loading()) {
              <div class="flex gap-3 overflow-hidden">
                @for (i of skeleton.slice(0, 6); track i) {
                  <div class="h-36 w-36 shrink-0 animate-pulse rounded-2xl bg-slate-200"></div>
                }
              </div>
            } @else {
              <div class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-6">
                <button
                  type="button"
                  class="group relative flex min-w-[8.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:min-w-0"
                  [class]="category() === null
                    ? 'border-emerald-600 shadow-md ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-emerald-300'"
                  [attr.aria-pressed]="category() === null"
                  (click)="onCategory(null); productsEl.scrollIntoView({ behavior: 'smooth' })"
                >
                  @if (category() === null) {
                    <i class="pi pi-check-circle absolute right-2 top-2 text-emerald-600"></i>
                  }
                  <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl transition group-hover:scale-110">
                    🛍️
                  </span>
                  <span class="min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800">Tất cả</span>
                  <span class="text-xs text-slate-500">{{ base().length }} sản phẩm</span>
                </button>

                @for (c of categories(); track c.name; let i = $index) {
                  <button
                    type="button"
                    class="group relative flex min-w-[8.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:min-w-0"
                    [class]="category() === c.name
                      ? 'border-emerald-600 shadow-md ring-2 ring-emerald-200'
                      : 'border-slate-200 hover:border-emerald-300'"
                    [class.opacity-50]="c.count === 0"
                    [attr.aria-pressed]="category() === c.name"
                    (click)="onCategory(c.name); productsEl.scrollIntoView({ behavior: 'smooth' })"
                  >
                    @if (category() === c.name) {
                      <i class="pi pi-check-circle absolute right-2 top-2 text-emerald-600"></i>
                    }
                    <span
                      class="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition group-hover:scale-110"
                      [class]="catTone(i)"
                    >
                      {{ categoryIcon(c.name) }}
                    </span>
                    <span class="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800">{{ c.name }}</span>
                    <span class="text-xs text-slate-500">{{ c.count }} sản phẩm</span>
                  </button>
                }
              </div>
            }
          </section>
        }

        <!-- Tất cả sản phẩm -->
        <section #productsEl class="scroll-mt-28">
          <div class="mb-4">
            <h2 class="text-xl font-bold text-slate-800 sm:text-2xl">Tất cả sản phẩm</h2>
            <p class="mt-1 text-sm text-slate-500">
              Tìm theo tên, thương hiệu hoặc loại hàng. Giá và tình trạng hàng có thể thay đổi.
            </p>
          </div>

          <!-- Bộ lọc và sắp xếp -->
          <div class="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div class="flex flex-wrap items-center gap-3">
              <label class="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                <span class="hidden sm:inline">Danh mục</span>
                <select
                  class="max-w-[11rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:max-w-none"
                  (change)="onCategory($any($event.target).value || null)"
                >
                  <option value="" [selected]="category() === null">Tất cả ({{ base().length }})</option>
                  @for (c of categories(); track c.name) {
                    <option [value]="c.name" [selected]="category() === c.name">{{ c.name }} ({{ c.count }})</option>
                  }
                </select>
              </label>

              <label class="flex items-center gap-2 text-sm text-slate-600">
                <span class="hidden sm:inline">Sắp xếp</span>
                <select
                  class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  (change)="onSort($any($event.target).value)"
                >
                  @for (o of sortOptions; track o.key) {
                    <option [value]="o.key" [selected]="sort() === o.key">{{ o.label }}</option>
                  }
                </select>
              </label>

              <button
                type="button"
                role="switch"
                class="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                [class]="inStockOnly()
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'"
                [attr.aria-checked]="inStockOnly()"
                (click)="onStock(!inStockOnly())"
              >
                <span class="relative h-5 w-9 rounded-full transition" [class]="inStockOnly() ? 'bg-emerald-600' : 'bg-slate-300'">
                  <span
                    class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                    [class]="inStockOnly() ? 'left-[1.125rem]' : 'left-0.5'"
                  ></span>
                </span>
                Chỉ còn hàng
              </button>

              @if (keyword().trim() !== '' || category() !== null || inStockOnly()) {
                <button
                  type="button"
                  class="ml-auto rounded-xl px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                  (click)="clearFilters()"
                >
                  <i class="pi pi-filter-slash mr-1 text-xs"></i> Xóa bộ lọc
                </button>
              }
            </div>

            @if (keyword().trim() !== '' || category() !== null) {
              <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                <span class="text-slate-500">Đang lọc:</span>
                @if (keyword().trim(); as k) {
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                    Từ khóa "{{ k }}"
                    <button type="button" class="text-slate-400 hover:text-slate-700" aria-label="Xóa từ khóa" (click)="onSearch('')">
                      <i class="pi pi-times text-[10px]"></i>
                    </button>
                  </span>
                }
                @if (category(); as cat) {
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                    {{ cat }}
                    <button type="button" class="text-emerald-400 hover:text-emerald-700" aria-label="Bỏ lọc danh mục" (click)="onCategory(null)">
                      <i class="pi pi-times text-[10px]"></i>
                    </button>
                  </span>
                }
              </div>
            }
          </div>

          @if (!loading() && !error()) {
            <p class="mb-4 text-sm text-slate-500">
              Hiển thị <b class="text-slate-800">{{ filtered().length }}</b> sản phẩm
            </p>
          }

          @if (error()) {
            <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <i class="pi pi-exclamation-circle mb-3 text-3xl text-red-500"></i>
              <p class="text-slate-700">{{ error() }}</p>
              <button
                type="button"
                class="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                (click)="load()"
              >
                Thử lại
              </button>
            </div>
          } @else if (loading()) {
            <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              @for (i of skeleton; track i) {
                <div class="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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
            <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <i class="pi pi-search mb-3 text-3xl text-slate-300"></i>
              @if (products().length === 0) {
                <p class="text-slate-600">Hiện chưa có sản phẩm nào để hiển thị.</p>
              } @else {
                <p class="text-slate-600">Không tìm thấy sản phẩm phù hợp.</p>
                <button type="button" class="mt-3 text-sm font-medium text-emerald-600 underline" (click)="clearFilters()">
                  Xóa bộ lọc
                </button>
              }
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              @for (p of visible(); track p.MaSanPham) {
                <button
                  type="button"
                  class="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  (click)="selected.set(p)"
                >
                  <div class="relative aspect-square overflow-hidden bg-slate-50">
                    @if (showImage(p)) {
                      <img
                        [src]="p.hinh_anh_url"
                        [alt]="p.TenSanPham"
                        loading="lazy"
                        class="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
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

                    <span
                      class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      [class]="p.con_hang
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-800/90 text-white'"
                    >
                      <span class="h-1.5 w-1.5 rounded-full" [class]="p.con_hang ? 'bg-emerald-500' : 'bg-red-400'"></span>
                      {{ p.con_hang ? 'Còn hàng' : 'Hết hàng' }}
                    </span>
                  </div>

                  <div class="flex flex-1 flex-col p-3">
                    <div class="truncate text-xs text-slate-500">{{ p.TenThuongHieu || categoryName(p) }}</div>
                    <h3 class="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-slate-800">
                      {{ p.TenSanPham }}
                    </h3>
                    <div class="mt-2 text-lg font-bold text-emerald-600">{{ price(p) | number: '1.0-0' }} ₫</div>
                  </div>
                </button>
              }
            </div>

            @if (hasMore()) {
              <div class="mt-8 text-center">
                <button
                  type="button"
                  class="rounded-full border border-emerald-600 bg-white px-7 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                  (click)="loadMore()"
                >
                  Xem thêm {{ remaining() }} sản phẩm
                </button>
              </div>
            }
          }
        </section>
      </main>

      <!-- Chân trang -->
      <footer class="mt-16 border-t border-slate-200 bg-white">
        <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Thương hiệu -->
            <div>
              <div class="flex items-center gap-2.5">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <i class="pi pi-shop text-lg"></i>
                </span>
                <h2 class="text-xl font-extrabold text-emerald-700">Convenience Store</h2>
              </div>
              <p class="mt-4 text-sm leading-6 text-slate-500">
                Mang đến những sản phẩm tiện lợi, chất lượng và trải nghiệm mua sắm tốt nhất mỗi ngày.
              </p>
            </div>

            <!-- Danh mục -->
            <div>
              <h3 class="font-semibold text-slate-800">Danh mục sản phẩm</h3>
              <ul class="mt-4 space-y-3 text-sm text-slate-500">
                @for (c of categories().slice(0, 6); track c.name) {
                  <li>
                    <button
                      type="button"
                      class="transition hover:translate-x-0.5 hover:text-emerald-600"
                      (click)="onCategory(c.name); productsEl.scrollIntoView({ behavior: 'smooth' })"
                    >
                      {{ c.name }}
                    </button>
                  </li>
                } @empty {
                  <li class="text-slate-400">Đang cập nhật</li>
                }
              </ul>
            </div>

            <!-- Hỗ trợ -->
            <div>
              <h3 class="font-semibold text-slate-800">Hỗ trợ khách hàng</h3>
              <ul class="mt-4 space-y-3 text-sm text-slate-500">
                <li>Chính sách mua hàng</li>
                <li>Chính sách đổi trả</li>
                <li>Câu hỏi thường gặp</li>
                <li>Liên hệ hỗ trợ</li>
              </ul>
            </div>

            <!-- Liên hệ -->
            <div>
              <h3 class="font-semibold text-slate-800">Liên hệ với chúng tôi</h3>
              <ul class="mt-4 space-y-3 text-sm text-slate-500">
                @if (store.address) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-map-marker mt-0.5 text-emerald-600"></i><span>{{ store.address }}</span>
                  </li>
                }
                @if (store.hotline) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-phone mt-0.5 text-emerald-600"></i>
                    <a [href]="'tel:' + store.hotline" class="transition hover:text-emerald-600">{{ store.hotline }}</a>
                  </li>
                }
                @if (store.email) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-envelope mt-0.5 text-emerald-600"></i>
                    <a [href]="'mailto:' + store.email" class="break-all transition hover:text-emerald-600">{{ store.email }}</a>
                  </li>
                }
                @if (!store.address && !store.hotline && !store.email) {
                  <li class="text-slate-400">Thông tin liên hệ đang được cập nhật.</li>
                }
              </ul>

              @if (store.social.facebook || store.social.instagram || store.social.youtube) {
                <div class="mt-4 flex gap-2">
                  @if (store.social.facebook) {
                    <a
                      [href]="store.social.facebook"
                      target="_blank"
                      rel="noopener"
                      aria-label="Facebook"
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-600 hover:text-white"
                    >
                      <i class="pi pi-facebook"></i>
                    </a>
                  }
                  @if (store.social.instagram) {
                    <a
                      [href]="store.social.instagram"
                      target="_blank"
                      rel="noopener"
                      aria-label="Instagram"
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-600 hover:text-white"
                    >
                      <i class="pi pi-instagram"></i>
                    </a>
                  }
                  @if (store.social.youtube) {
                    <a
                      [href]="store.social.youtube"
                      target="_blank"
                      rel="noopener"
                      aria-label="YouTube"
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-600 hover:text-white"
                    >
                      <i class="pi pi-youtube"></i>
                    </a>
                  }
                </div>
              }
            </div>
          </div>

          <div class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row">
            <p>© {{ year }} Convenience Store. All rights reserved.</p>
            <p>Giá và tình trạng hàng có thể thay đổi.</p>
          </div>
        </div>
      </footer>
    </div>

    <!-- Chi tiết sản phẩm (chỉ xem) -->
    <p-dialog
      header="Chi tiết sản phẩm"
      [modal]="true"
      [dismissableMask]="true"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [style]="{ width: 'min(44rem, 94vw)' }"
    >
      @if (selected(); as p) {
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="relative aspect-square overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            @if (showImage(p)) {
              <img
                [src]="p.hinh_anh_url"
                [alt]="p.TenSanPham"
                class="h-full w-full object-contain p-4"
                [class.opacity-60]="!p.con_hang"
                [class.grayscale]="!p.con_hang"
                (error)="markFailed(p)"
              />
            } @else {
              <div class="flex h-full w-full items-center justify-center text-7xl font-bold" [class]="color(p)">
                {{ initial(p) }}
              </div>
            }
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-slate-400">
                {{ p.TenThuongHieu || categoryName(p) }}
              </div>
              <h3 class="mt-1 text-xl font-bold leading-6 text-slate-800">{{ p.TenSanPham }}</h3>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="text-3xl font-extrabold text-emerald-600">{{ price(p) | number: '1.0-0' }} ₫</div>
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                [class]="p.con_hang ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
              >
                <span class="h-1.5 w-1.5 rounded-full" [class]="p.con_hang ? 'bg-emerald-500' : 'bg-red-400'"></span>
                {{ p.con_hang ? 'Còn hàng' : 'Hết hàng' }}
              </span>
            </div>

            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <dt class="text-xs text-slate-500">Loại</dt>
                <dd class="font-medium text-slate-800">{{ categoryName(p) }}</dd>
              </div>
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <dt class="text-xs text-slate-500">Thương hiệu</dt>
                <dd class="font-medium text-slate-800">{{ p.TenThuongHieu || '—' }}</dd>
              </div>
            </dl>
          </div>
        </div>

        @if (p.MoTa || p.ThanhPhan) {
          <div class="mt-5 space-y-4 border-t border-slate-100 pt-4">
            @if (p.MoTa) {
              <div>
                <h4 class="mb-1 text-sm font-semibold text-slate-700">Mô tả</h4>
                <p class="text-sm leading-6 text-slate-600">{{ p.MoTa }}</p>
              </div>
            }
            @if (p.ThanhPhan) {
              <div>
                <h4 class="mb-1 text-sm font-semibold text-slate-700">Thành phần</h4>
                <p class="text-sm leading-6 text-slate-600">{{ p.ThanhPhan }}</p>
              </div>
            }
          </div>
        }

        <p class="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <i class="pi pi-info-circle mt-0.5"></i>
          <span>Trang này chỉ dùng để xem thông tin. Vui lòng mua trực tiếp tại cửa hàng.</span>
        </p>
      }
    </p-dialog>
  `,
})
export class PublicHome {
  private service = inject(PublicService);
  protected auth = inject(AuthService);

  readonly store = STORE;
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

  // Biểu tượng và màu nền của thẻ danh mục
  categoryIcon(name: string): string {
    const text = normalize(name);
    const words = text.split(/[^a-z0-9]+/).filter(Boolean);
    const hit = CATEGORY_ICONS.find((c) =>
      c.keys.some((k) => (k.includes(' ') ? text.includes(k) : words.includes(k))),
    );
    return hit?.icon ?? '🛍️';
  }

  catTone(index: number): string {
    return CAT_TONES[index % CAT_TONES.length];
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
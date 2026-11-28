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
  'bg-indigo-100 text-indigo-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

// Màu nền nhẹ cho biểu tượng danh mục
const CAT_TONES = ['bg-indigo-50', 'bg-sky-50', 'bg-amber-50', 'bg-rose-50', 'bg-violet-50', 'bg-teal-50'];

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
      <div class="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-indigo-50">
        <div class="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 text-[11px] font-medium tracking-wide sm:justify-between sm:text-xs">
          <span class="flex items-center gap-1.5">
            <i class="pi pi-bolt text-[10px] text-indigo-300"></i> Xem giá và khám phá sản phẩm trước khi ghé cửa hàng
          </span>
          <span class="hidden items-center gap-1.5 sm:flex">
            <i class="pi pi-shop text-[10px] text-indigo-300"></i> Mua trực tiếp tại quầy · Giá có thể thay đổi
          </span>
        </div>
      </div>

      <!-- Thanh trên cùng -->
      <header class="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-xl">
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6">
          <a routerLink="/" class="flex shrink-0 items-center gap-2.5">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
              <i class="pi pi-shop text-lg"></i>
            </span>
            <span class="hidden leading-4 sm:block">
              <span class="block text-lg font-extrabold tracking-tight text-slate-800">Cửa hàng tiện lợi</span>
              <span class="block text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Convenience Store</span>
            </span>
          </a>

          <div class="relative min-w-0 flex-1 lg:mx-auto lg:max-w-2xl">
            <i class="pi pi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
            <input
              type="search"
              placeholder="Tìm sản phẩm, ví dụ: nuoc ngot, mi goi, sua..."
              class="w-full rounded-full border border-slate-200 bg-slate-100/70 py-2.5 pl-11 pr-4 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
              [value]="keyword()"
              (input)="onSearch($any($event.target).value)"
            />
          </div>

          <div class="hidden shrink-0 items-center lg:flex">
            @if (store.hotline) {
              <a
                [href]="'tel:' + store.hotline"
                class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 transition hover:bg-indigo-50"
              >
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <i class="pi pi-phone"></i>
                </span>
                <span class="leading-4">
                  <span class="block text-xs text-slate-500">Hotline hỗ trợ</span>
                  <span class="block text-sm font-semibold text-slate-800">{{ store.hotline }}</span>
                </span>
              </a>
            } @else {
              <div class="flex items-center gap-2.5 py-1 pl-1 pr-2">
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
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
        style="background-image: linear-gradient(130deg, #1e1b4b 0%, #4338ca 45%, #6366f1 100%)"
      >
        <div class="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl"></div>
        <div class="pointer-events-none absolute inset-0 opacity-[0.07]" style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 22px 22px;"></div>

        <div class="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:grid-cols-2 lg:py-16">
          <div>
            <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide ring-1 ring-white/25 backdrop-blur">
              <i class="pi pi-sparkles text-[11px] text-indigo-200"></i> Cửa hàng tiện lợi
            </span>
            <h1 class="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Mua sắm tiện lợi
              <span class="mt-1 block bg-gradient-to-r from-indigo-200 via-violet-100 to-white bg-clip-text text-transparent">
                mỗi ngày
              </span>
            </h1>
            <p class="mt-5 max-w-xl text-base leading-relaxed text-indigo-50/90 sm:text-lg">
              Đồ uống, thực phẩm, bánh kẹo và nhiều mặt hàng thiết yếu khác. Khám phá sản phẩm và giá bán ngay tại đây
              trước khi ghé cửa hàng.
            </p>

            <div class="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-700 shadow-xl shadow-indigo-950/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                (click)="productsEl.scrollIntoView({ behavior: 'smooth' })"
              >
                Khám phá sản phẩm <i class="pi pi-arrow-down text-xs"></i>
              </button>

              @if (!loading() && !error()) {
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-indigo-50 ring-1 ring-white/20 backdrop-blur">
                    <i class="pi pi-box text-[11px] text-indigo-200"></i> {{ products().length }} sản phẩm
                  </span>
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-indigo-50 ring-1 ring-white/20 backdrop-blur">
                    <i class="pi pi-tags text-[11px] text-indigo-200"></i> {{ categories().length }} danh mục
                  </span>
                </div>
              }
            </div>
          </div>

          <!-- Hình minh họa -->
          <div class="relative mx-auto h-56 w-full max-w-sm sm:h-64 md:h-72 lg:h-80" aria-hidden="true">
            <div class="absolute inset-6 rounded-[3rem] bg-white/10"></div>
            <div class="absolute inset-14 rounded-[2.5rem] bg-white/10"></div>

            <div class="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-2xl shadow-indigo-950/30 sm:h-28 sm:w-28 sm:text-6xl">
              🛒
            </div>
            <div class="absolute left-[3%] top-[4%] flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-950/25 transition duration-500 hover:rotate-0 sm:h-20 sm:w-20 sm:text-4xl text-3xl">
              🥤
            </div>
            <div class="absolute right-[3%] top-[8%] flex h-16 w-16 rotate-6 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-950/25 transition duration-500 hover:rotate-0 sm:h-20 sm:w-20 sm:text-4xl text-3xl">
              🍜
            </div>
            <div class="absolute bottom-[6%] left-[8%] flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-950/25 transition duration-500 hover:rotate-0 sm:h-20 sm:w-20 sm:text-4xl text-3xl">
              🍪
            </div>
            <div class="absolute bottom-[4%] right-[6%] flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-950/25 transition duration-500 hover:rotate-0 sm:h-20 sm:w-20 sm:text-4xl text-3xl">
              🧃
            </div>
          </div>
        </div>
      </section>

      <main class="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        <!-- Danh mục -->
        @if (loading() || categories().length > 1) {
          <section class="mb-12">
            <div class="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Danh mục</span>
                <h2 class="mt-1 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Khám phá danh mục</h2>
                <p class="mt-1 text-sm text-slate-500">Chọn một danh mục để xem nhanh các sản phẩm cùng loại.</p>
              </div>
            </div>

            @if (loading()) {
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                @for (i of skeleton.slice(0, 6); track i) {
                  <div class="h-32 animate-pulse rounded-2xl bg-slate-200/80"></div>
                }
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                <button
                  type="button"
                  class="group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  [class]="category() === null
                    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200 shadow-md shadow-indigo-500/10'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg'"
                  [attr.aria-pressed]="category() === null"
                  (click)="onCategory(null); productsEl.scrollIntoView({ behavior: 'smooth' })"
                >
                  @if (category() === null) {
                    <i class="pi pi-check-circle absolute right-2.5 top-2.5 text-sm text-indigo-600"></i>
                  }
                  <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-3xl transition duration-300 group-hover:scale-110">
                    🛍️
                  </span>
                  <span class="min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800">Tất cả</span>
                  <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{{ base().length }} sản phẩm</span>
                </button>

                @for (c of categories(); track c.name; let i = $index) {
                  <button
                    type="button"
                    class="group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    [class]="category() === c.name
                      ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200 shadow-md shadow-indigo-500/10'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg'"
                    [class.opacity-50]="c.count === 0"
                    [attr.aria-pressed]="category() === c.name"
                    (click)="onCategory(c.name); productsEl.scrollIntoView({ behavior: 'smooth' })"
                  >
                    @if (category() === c.name) {
                      <i class="pi pi-check-circle absolute right-2.5 top-2.5 text-sm text-indigo-600"></i>
                    }
                    <span
                      class="flex h-12 w-12 items-center justify-center rounded-2xl text-3xl transition duration-300 group-hover:scale-110"
                      [class]="catTone(i)"
                    >
                      {{ categoryIcon(c.name) }}
                    </span>
                    <span class="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800">{{ c.name }}</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{{ c.count }} sản phẩm</span>
                  </button>
                }
              </div>
            }
          </section>
        }

        <!-- Tất cả sản phẩm -->
        <section #productsEl class="scroll-mt-28">
          <div class="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Sản phẩm</span>
              <h2 class="mt-1 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Tất cả sản phẩm</h2>
              <p class="mt-1 text-sm text-slate-500">Tìm theo tên, thương hiệu hoặc loại hàng. Giá có thể thay đổi.</p>
            </div>
            @if (!loading() && !error()) {
              <span class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700">
                <i class="pi pi-box text-[11px]"></i> {{ filtered().length }} sản phẩm
              </span>
            }
          </div>

          <!-- Bộ lọc và sắp xếp -->
          <div class="mb-6 rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm sm:p-4">
            <div class="flex flex-wrap items-center gap-2.5">
              <div class="relative min-w-0 flex-1 sm:max-w-[17rem]">
                <i class="pi pi-th-large pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                <i class="pi pi-chevron-down pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"></i>
                <select
                  class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-9 text-sm font-medium text-slate-700 transition hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  (change)="onCategory($any($event.target).value || null)"
                >
                  <option value="" [selected]="category() === null">Tất cả danh mục ({{ base().length }})</option>
                  @for (c of categories(); track c.name) {
                    <option [value]="c.name" [selected]="category() === c.name">{{ c.name }} ({{ c.count }})</option>
                  }
                </select>
              </div>

              <div class="relative min-w-0 flex-1 sm:max-w-[14rem]">
                <i class="pi pi-sort-alt pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                <i class="pi pi-chevron-down pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"></i>
                <select
                  class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-9 text-sm font-medium text-slate-700 transition hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  (change)="onSort($any($event.target).value)"
                >
                  @for (o of sortOptions; track o.key) {
                    <option [value]="o.key" [selected]="sort() === o.key">{{ o.label }}</option>
                  }
                </select>
              </div>

              @if (keyword().trim() !== '' || category() !== null || inStockOnly()) {
                <button
                  type="button"
                  class="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  (click)="clearFilters()"
                >
                  <i class="pi pi-filter-slash text-xs"></i> Xóa bộ lọc
                </button>
              }
            </div>

            @if (keyword().trim() !== '' || category() !== null) {
              <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                <span class="text-slate-500">Đang lọc:</span>
                @if (keyword().trim(); as k) {
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                    Từ khóa "{{ k }}"
                    <button type="button" class="text-slate-400 transition hover:text-slate-700" aria-label="Xóa từ khóa" (click)="onSearch('')">
                      <i class="pi pi-times text-[10px]"></i>
                    </button>
                  </span>
                }
                @if (category(); as cat) {
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 ring-1 ring-indigo-100">
                    {{ cat }}
                    <button type="button" class="text-indigo-400 transition hover:text-indigo-700" aria-label="Bỏ lọc danh mục" (click)="onCategory(null)">
                      <i class="pi pi-times text-[10px]"></i>
                    </button>
                  </span>
                }
              </div>
            }
          </div>

          @if (error()) {
            <div class="rounded-3xl border border-slate-200/70 bg-white p-12 text-center shadow-sm">
              <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <i class="pi pi-exclamation-circle text-2xl"></i>
              </span>
              <p class="text-slate-700">{{ error() }}</p>
              <button
                type="button"
                class="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-violet-700"
                (click)="load()"
              >
                <i class="pi pi-replay text-xs"></i> Thử lại
              </button>
            </div>
          } @else if (loading()) {
            <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              @for (i of skeleton; track i) {
                <div class="animate-pulse overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                  <div class="aspect-square bg-slate-200/80"></div>
                  <div class="space-y-2.5 p-4">
                    <div class="h-2.5 w-1/3 rounded-full bg-slate-200"></div>
                    <div class="h-4 w-4/5 rounded-full bg-slate-200"></div>
                    <div class="h-5 w-1/2 rounded-full bg-slate-200"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (filtered().length === 0) {
            <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <i class="pi pi-search text-2xl"></i>
              </span>
              @if (products().length === 0) {
                <p class="text-slate-600">Hiện chưa có sản phẩm nào để hiển thị.</p>
              } @else {
                <p class="text-slate-600">Không tìm thấy sản phẩm phù hợp.</p>
                <button type="button" class="mt-3 text-sm font-semibold text-indigo-600 underline underline-offset-4" (click)="clearFilters()">
                  Xóa bộ lọc
                </button>
              }
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              @for (p of visible(); track p.MaSanPham) {
                <button
                  type="button"
                  class="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_18px_40px_-12px_rgba(99, 102, 241,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  (click)="selected.set(p)"
                >
                  <div class="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                    @if (showImage(p)) {
                      <img
                        [src]="p.hinh_anh_url"
                        [alt]="p.TenSanPham"
                        loading="lazy"
                        class="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
                        (error)="markFailed(p)"
                      />
                    } @else {
                      <div
                        class="flex h-full w-full items-center justify-center text-5xl font-bold"
                        [class]="color(p)"
                      >
                        {{ initial(p) }}
                      </div>
                    }

                    <span
                      class="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                      <i class="pi pi-eye text-[10px]"></i> Xem chi tiết
                    </span>
                  </div>

                  <div class="flex flex-1 flex-col gap-1 p-4">
                    <span class="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                      {{ p.TenThuongHieu || categoryName(p) }}
                    </span>
                    <h3 class="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800">
                      {{ p.TenSanPham }}
                    </h3>
                    <div class="mt-auto flex items-end justify-between pt-2">
                      <span class="text-lg font-extrabold tracking-tight text-slate-900">
                        {{ price(p) | number: '1.0-0' }}<span class="ml-0.5 text-sm font-bold text-indigo-600">₫</span>
                      </span>
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition duration-300 group-hover:bg-indigo-600 group-hover:text-white">
                        <i class="pi pi-arrow-right text-[11px]"></i>
                      </span>
                    </div>
                  </div>
                </button>
              }
            </div>

            @if (hasMore()) {
              <div class="mt-10 text-center">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-indigo-600 bg-white px-7 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/25"
                  (click)="loadMore()"
                >
                  Xem thêm {{ remaining() }} sản phẩm
                  <i class="pi pi-arrow-down text-xs"></i>
                </button>
              </div>
            }
          }
        </section>
      </main>

      <!-- Chân trang -->
      <footer class="mt-16 bg-slate-900 text-slate-300">
        <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Thương hiệu -->
            <div>
              <div class="flex items-center gap-2.5">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                  <i class="pi pi-shop text-lg"></i>
                </span>
                <h2 class="text-xl font-extrabold tracking-tight text-white">Convenience Store</h2>
              </div>
              <p class="mt-4 text-sm leading-6 text-slate-400">
                Mang đến những sản phẩm tiện lợi, chất lượng và trải nghiệm mua sắm tốt nhất mỗi ngày.
              </p>
            </div>

            <!-- Danh mục -->
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-white">Danh mục sản phẩm</h3>
              <ul class="mt-4 space-y-3 text-sm">
                @for (c of categories().slice(0, 6); track c.name) {
                  <li>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 text-slate-400 transition hover:translate-x-0.5 hover:text-indigo-400"
                      (click)="onCategory(c.name); productsEl.scrollIntoView({ behavior: 'smooth' })"
                    >
                      <i class="pi pi-angle-right text-[10px]"></i>{{ c.name }}
                    </button>
                  </li>
                } @empty {
                  <li class="text-slate-500">Đang cập nhật</li>
                }
              </ul>
            </div>

            <!-- Hỗ trợ -->
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-white">Hỗ trợ khách hàng</h3>
              <ul class="mt-4 space-y-3 text-sm text-slate-400">
                <li>Chính sách mua hàng</li>
                <li>Chính sách đổi trả</li>
                <li>Câu hỏi thường gặp</li>
                <li>Liên hệ hỗ trợ</li>
              </ul>
            </div>

            <!-- Liên hệ -->
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-white">Liên hệ với chúng tôi</h3>
              <ul class="mt-4 space-y-3 text-sm text-slate-400">
                @if (store.address) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-map-marker mt-0.5 text-indigo-400"></i><span>{{ store.address }}</span>
                  </li>
                }
                @if (store.hotline) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-phone mt-0.5 text-indigo-400"></i>
                    <a [href]="'tel:' + store.hotline" class="transition hover:text-indigo-400">{{ store.hotline }}</a>
                  </li>
                }
                @if (store.email) {
                  <li class="flex gap-2.5">
                    <i class="pi pi-envelope mt-0.5 text-indigo-400"></i>
                    <a [href]="'mailto:' + store.email" class="break-all transition hover:text-indigo-400">{{ store.email }}</a>
                  </li>
                }
                @if (!store.address && !store.hotline && !store.email) {
                  <li class="text-slate-500">Thông tin liên hệ đang được cập nhật.</li>
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
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-indigo-500 hover:text-white"
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
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-indigo-500 hover:text-white"
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
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-indigo-500 hover:text-white"
                    >
                      <i class="pi pi-youtube"></i>
                    </a>
                  }
                </div>
              }
            </div>
          </div>

          <div class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© {{ year }} Convenience Store. All rights reserved.</p>
            <p>Giá bán có thể thay đổi.</p>
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
      [style]="{ width: 'min(46rem, 94vw)' }"
    >
      @if (selected(); as p) {
        <div class="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div class="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-100">
            @if (showImage(p)) {
              <img
                [src]="p.hinh_anh_url"
                [alt]="p.TenSanPham"
                class="h-full w-full object-contain p-5"
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
              <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">
                {{ p.TenThuongHieu || categoryName(p) }}
              </div>
              <h3 class="mt-1.5 text-xl font-extrabold leading-6 tracking-tight text-slate-800">{{ p.TenSanPham }}</h3>
            </div>

            <div class="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3 ring-1 ring-indigo-100">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-indigo-700/70">Giá bán</div>
              <div class="mt-0.5 text-3xl font-extrabold tracking-tight text-indigo-700">
                {{ price(p) | number: '1.0-0' }}<span class="ml-1 text-lg font-bold">₫</span>
              </div>
            </div>

            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-2xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Loại</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ categoryName(p) }}</dd>
              </div>
              <div class="rounded-2xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Thương hiệu</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ p.TenThuongHieu || '—' }}</dd>
              </div>
            </dl>
          </div>
        </div>

        @if (p.MoTa || p.ThanhPhan) {
          <div class="mt-6 space-y-4 border-t border-slate-100 pt-5">
            @if (p.MoTa) {
              <div>
                <h4 class="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                  <i class="pi pi-align-left text-xs text-indigo-500"></i> Mô tả
                </h4>
                <p class="text-sm leading-6 text-slate-600">{{ p.MoTa }}</p>
              </div>
            }
            @if (p.ThanhPhan) {
              <div>
                <h4 class="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                  <i class="pi pi-list text-xs text-indigo-500"></i> Thành phần
                </h4>
                <p class="text-sm leading-6 text-slate-600">{{ p.ThanhPhan }}</p>
              </div>
            }
          </div>
        }

        <p class="mt-5 flex items-start gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800 ring-1 ring-indigo-100">
          <i class="pi pi-info-circle mt-0.5"></i>
          <span>Trang này chỉ dùng để xem thông tin. Vui lòng mua trực tiếp tại cửa hàng.</span>
        </p>
      }

      <ng-template #footer>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          (click)="selected.set(null)"
        >
          <i class="pi pi-times text-xs"></i> Đóng
        </button>
      </ng-template>
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
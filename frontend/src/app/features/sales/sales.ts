import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { environment } from '../../../environments/environment';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { PromotionService } from '../promotions/promotion.service';
import { Draft, SalesService } from './sales.service';
import { ConfirmService } from '../../core/ui/confirm.service';

interface CartLine {
  product: Product;
  qty: number;
}

interface Receipt {
  id: number;
  total: number;
  discount: number;
  method: string;
  given: number | null;
}

interface Indexed {
  p: Product;
  name: string; // tên đã bỏ dấu, viết thường
  words: string[];
  all: string; // tên + thương hiệu + danh mục
}

// Bỏ dấu để gõ "nuoc" vẫn ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const OTHER = 'Khác';
const categoryOf = (p: Product) => p.LoaiSanPham?.trim() || OTHER;

// Màu nền cho sản phẩm chưa có ảnh
const COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

@Component({
  selector: 'app-sales',
  imports: [DecimalPipe, DatePipe, RouterLink, ButtonModule, DialogModule],
  template: `
    <div class="grid gap-4 pb-20 lg:h-[calc(100vh-6.5rem)] lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0">
      <!-- ================= CỘT TRÁI: tìm và chọn sản phẩm ================= -->
      <section class="flex min-h-0 flex-col gap-3">
        <div class="shrink-0 space-y-3">
          @if (receipt(); as r) {
            <div class="rounded-xl bg-emerald-50 p-4 text-emerald-800">
              <div class="font-semibold">Thanh toán thành công, hóa đơn #{{ r.id }}</div>
              <div class="mt-1 text-sm">
                Tổng tiền: <b>{{ r.total | number: '1.0-0' }} ₫</b> ({{ r.method }})
                @if (r.discount > 0) {
                  · Đã giảm {{ r.discount | number: '1.0-0' }} ₫
                }
                @if (r.method === 'Tiền mặt' && r.given !== null && r.given >= r.total) {
                  · Khách đưa {{ r.given | number: '1.0-0' }} ₫ · Tiền thừa
                  <b>{{ r.given - r.total | number: '1.0-0' }} ₫</b>
                }
              </div>
              <p-button label="Hóa đơn mới" icon="pi pi-plus" size="small" class="mt-3" (onClick)="newInvoice()" />
            </div>
          }

          @if (queued(); as q) {
            <div class="rounded-xl bg-amber-50 p-4 text-amber-800">
              <div class="font-semibold">Đã lưu hóa đơn #{{ q.id }} vào hàng đợi</div>
              <div class="mt-1 text-sm">
                Hàng được giữ @if (q.until) { đến <b>{{ q.until | date: 'HH:mm' }}</b> }. Quá hạn mà chưa thanh toán,
                hóa đơn tự hủy và hoàn lại kho.
              </div>
              <a
                routerLink="/admin/invoices"
                class="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Xem hàng đợi <i class="pi pi-arrow-right text-xs"></i>
              </a>
            </div>
          }

          @if (error()) {
            <div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
          }

          <!-- Ô tìm kiếm -->
          <div class="relative">
            <i class="pi pi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              id="search"
              type="text"
              autocomplete="off"
              placeholder="Gõ chữ cái đầu của tên sản phẩm, ví dụ: n, nuoc, tra..."
              class="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              [value]="keyword()"
              (input)="keyword.set($any($event.target).value)"
              (keydown.enter)="addFirst()"
              (keydown.escape)="clearSearch()"
            />
            @if (keyword()) {
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
                aria-label="Xóa từ khóa"
                (click)="clearSearch()"
              >
                <i class="pi pi-times-circle"></i>
              </button>
            }
          </div>
          <p class="text-xs text-slate-500">
            @if (keyword().trim()) {
              {{ filtered().length }} kết quả cho "{{ keyword().trim() }}"
              @if (firstAvailable()) { · nhấn <b>Enter</b> để thêm sản phẩm đầu tiên }
            } @else {
              {{ filtered().length }} sản phẩm · bấm vào sản phẩm để thêm vào hóa đơn
            }
          </p>
        </div>

        <!-- Lưới sản phẩm -->
        <div class="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
          @if (loading()) {
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              @for (i of skeleton; track i) {
                <div class="animate-pulse overflow-hidden rounded-xl bg-white shadow-sm">
                  <div class="aspect-[4/3] bg-slate-200"></div>
                  <div class="space-y-2 p-3">
                    <div class="h-3 w-4/5 rounded bg-slate-200"></div>
                    <div class="h-4 w-1/2 rounded bg-slate-200"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (filtered().length === 0) {
            <div class="rounded-xl bg-white p-10 text-center shadow-sm">
              <i class="pi pi-search mb-3 text-3xl text-slate-300"></i>
              <p class="text-slate-600">
                {{ products().length === 0 ? 'Chưa có sản phẩm nào đang bán.' : 'Không tìm thấy sản phẩm phù hợp.' }}
              </p>
              @if (keyword() || category()) {
                <button type="button" class="mt-3 text-sm text-emerald-600 underline" (click)="clearFilters()">
                  Xóa bộ lọc
                </button>
              }
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              @for (p of filtered(); track p.MaSanPham) {
                <button
                  type="button"
                  class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  [class.ring-2]="!!keyword().trim() && p === firstAvailable()"
                  [class.ring-emerald-400]="!!keyword().trim() && p === firstAvailable()"
                  [disabled]="stockOf(p) <= 0"
                  (click)="add(p)"
                >
                  <div class="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    @if (showImage(p)) {
                      <img
                        [src]="p.hinh_anh_url"
                        [alt]="p.TenSanPham"
                        loading="lazy"
                        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        [class.opacity-40]="stockOf(p) <= 0"
                        [class.grayscale]="stockOf(p) <= 0"
                        (error)="markFailed(p)"
                      />
                    } @else {
                      <div
                        class="flex h-full w-full items-center justify-center text-4xl font-bold"
                        [class]="color(p)"
                        [class.opacity-50]="stockOf(p) <= 0"
                      >
                        {{ initial(p) }}
                      </div>
                    }

                    @if (cartQty().get(p.MaSanPham); as n) {
                      <span class="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                        ×{{ n }}
                      </span>
                    }
                    @if (stockOf(p) <= 0) {
                      <span class="absolute left-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
                        Hết hàng
                      </span>
                    }
                  </div>

                  <div class="flex flex-1 flex-col p-2.5">
                    <div class="line-clamp-2 min-h-[2.25rem] text-sm font-medium leading-[1.125rem] text-slate-800">
                      {{ p.TenSanPham }}
                    </div>
                    <div class="mt-1.5 flex items-end justify-between gap-2">
                      <span class="font-bold text-emerald-600">{{ price(p) | number: '1.0-0' }} ₫</span>
                      <span class="text-xs" [class]="stockClass(p)">{{ stockLabel(p) }}</span>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>
      </section>

      <!-- ================= CỘT PHẢI: hóa đơn và thanh toán ================= -->
      <aside #cartEl class="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <div class="font-semibold text-slate-800">Hóa đơn hiện tại</div>
            <div class="text-xs text-slate-500">{{ itemCount() }} sản phẩm</div>
          </div>
          @if (lines().length > 0) {
            <button type="button" class="text-xs text-red-600 hover:underline" (click)="clearCart()">Xóa hết</button>
          }
        </div>

        <div class="max-h-96 min-h-40 flex-1 overflow-y-auto lg:max-h-none">
          @if (lines().length === 0) {
            <div class="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-slate-400">
              <i class="pi pi-shopping-cart text-4xl"></i>
              <p class="text-sm">Chưa có sản phẩm nào.<br />Bấm vào sản phẩm bên cạnh để thêm.</p>
            </div>
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (l of lines(); track l.product.MaSanPham) {
                <li class="flex gap-3 px-4 py-3">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    @if (showImage(l.product)) {
                      <img [src]="l.product.hinh_anh_url" alt="" class="h-full w-full object-cover" (error)="markFailed(l.product)" />
                    } @else {
                      <span class="text-lg font-bold" [class]="color(l.product)">{{ initial(l.product) }}</span>
                    }
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <div class="truncate text-sm font-medium text-slate-800" [title]="l.product.TenSanPham">
                        {{ l.product.TenSanPham }}
                      </div>
                      <button
                        type="button"
                        class="shrink-0 text-slate-400 hover:text-red-600"
                        aria-label="Bỏ sản phẩm"
                        (click)="remove(l)"
                      >
                        <i class="pi pi-times text-xs"></i>
                      </button>
                    </div>
                    <div class="text-xs text-slate-500">{{ price(l.product) | number: '1.0-0' }} ₫</div>

                    <div class="mt-1 flex items-center justify-between">
                      <div class="inline-flex items-center overflow-hidden rounded-lg border border-slate-200">
                        <button type="button" class="h-8 w-8 text-slate-600 hover:bg-slate-50" aria-label="Giảm" (click)="change(l, -1)">
                          <i class="pi pi-minus text-xs"></i>
                        </button>
                        <input
                          type="number"
                          min="1"
                          class="h-8 w-12 border-x border-slate-200 text-center text-sm focus:outline-none"
                          [value]="l.qty"
                          (change)="setQty(l, $event)"
                        />
                        <button type="button" class="h-8 w-8 text-slate-600 hover:bg-slate-50" aria-label="Tăng" (click)="change(l, 1)">
                          <i class="pi pi-plus text-xs"></i>
                        </button>
                      </div>
                      <span class="text-sm font-semibold text-slate-800">
                        {{ price(l.product) * l.qty | number: '1.0-0' }} ₫
                      </span>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <div class="shrink-0 space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
          <div class="space-y-1">
            <div class="flex items-baseline justify-between text-sm text-slate-600">
              <span>Tạm tính</span><span>{{ total() | number: '1.0-0' }} ₫</span>
            </div>
            @if (discount() > 0) {
              <div class="flex items-baseline justify-between text-sm text-emerald-700">
                <span>Giảm giá ({{ promoName() }})</span><span>-{{ discount() | number: '1.0-0' }} ₫</span>
              </div>
            }
            <div class="flex items-baseline justify-between pt-1">
              <span class="font-medium text-slate-700">Cần thanh toán</span>
              <span class="text-2xl font-bold text-slate-900">{{ payable() | number: '1.0-0' }} ₫</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            @for (m of methods; track m.name) {
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                [class]="method() === m.name
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                (click)="method.set(m.name)"
              >
                <i [class]="m.icon"></i>{{ m.name }}
              </button>
            }
          </div>

          @if (method() === 'Tiền mặt') {
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600">Khách đưa (₫)</label>
              <input
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-lg font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="0"
                [value]="given() ?? ''"
                (input)="onGiven($any($event.target).value)"
              />

              @if (quickCash().length) {
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @for (v of quickCash(); track v) {
                    <button
                      type="button"
                      class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                      (click)="given.set(v)"
                    >
                      {{ v === payable() ? 'Vừa đủ' : (v | number: '1.0-0') }}
                    </button>
                  }
                </div>
              }

              @if (given() !== null && given()! >= payable() && payable() > 0) {
                <div class="mt-2 flex items-baseline justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                  <span class="text-sm">Tiền thừa</span>
                  <b class="text-lg">{{ given()! - payable() | number: '1.0-0' }} ₫</b>
                </div>
              }
              @if (given() !== null && given()! < payable()) {
                <div class="mt-2 text-sm text-red-600">Khách đưa chưa đủ.</div>
              }
            </div>
          }

          <p-button
            [label]="method() === 'Chuyển khoản' ? 'Hiện mã QR' : 'Thanh toán'"
            [icon]="method() === 'Chuyển khoản' ? 'pi pi-qrcode' : 'pi pi-check'"
            styleClass="w-full"
            size="large"
            [disabled]="!canPay()"
            [loading]="busy() && !pending()"
            (onClick)="pay()"
          />
          <p-button
            label="Lưu vào hàng đợi (giữ hàng 1 giờ)"
            icon="pi pi-clock"
            styleClass="w-full"
            [outlined]="true"
            [disabled]="lines().length === 0 || busy()"
            (onClick)="holdInvoice()"
          />
          <p class="text-xs text-slate-500">Giá và tổng tiền cuối cùng do máy chủ tính khi thanh toán.</p>
        </div>
      </aside>
    </div>

    <!-- Thanh nổi trên điện thoại: bấm để cuộn xuống hóa đơn -->
    @if (lines().length > 0) {
      <button
        type="button"
        class="fixed inset-x-4 bottom-4 z-10 flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-lg lg:hidden"
        (click)="cartEl.scrollIntoView({ behavior: 'smooth' })"
      >
        <span><i class="pi pi-shopping-cart mr-2"></i>{{ itemCount() }} sản phẩm</span>
        <span class="font-semibold">{{ payable() | number: '1.0-0' }} ₫</span>
      </button>
    }

    <!-- Mã QR chuyển khoản -->
    <p-dialog
      header="Thanh toán chuyển khoản"
      [modal]="true"
      [closable]="false"
      [visible]="!!pending()"
      [style]="{ width: '24rem' }"
    >
      @if (pending(); as p) {
        <div class="space-y-3 text-center">
          @if (qrFailed()) {
            <div class="rounded-lg bg-red-50 px-3 py-6 text-sm text-red-700">
              Không tải được mã QR. Kiểm tra kết nối mạng và thông tin ngân hàng trong environment.
            </div>
          } @else {
            <img
              [src]="qrUrl()"
              alt="Mã QR chuyển khoản"
              class="mx-auto w-64 rounded-lg border border-slate-200"
              (error)="qrFailed.set(true)"
            />
          }

          <div class="text-2xl font-semibold text-slate-800">{{ p.total | number: '1.0-0' }} ₫</div>

          <div class="text-sm text-slate-600">
            <div>{{ bank.bankId }} · {{ bank.accountNo }}</div>
            <div>{{ bank.accountName }}</div>
            <div>Nội dung: <b>HD{{ p.id }}</b></div>
          </div>

          <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Chỉ bấm "Đã nhận tiền" khi đã thấy tiền về tài khoản (kiểm tra bằng app ngân hàng).
          </p>
        </div>
      }

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="cancelTransfer()" />
        <p-button label="Chờ thanh toán" icon="pi pi-clock" [outlined]="true" [disabled]="busy()" (onClick)="holdPending()" />
        <p-button label="Đã nhận tiền" icon="pi pi-check" [loading]="busy()" (onClick)="confirmTransfer()" />
      </ng-template>
    </p-dialog>
  `,
})
export class Sales {
  private productService = inject(ProductService);
  private promoService = inject(PromotionService);
  private sales = inject(SalesService);
  private confirmDialog = inject(ConfirmService);

  readonly methods = [
    { name: 'Tiền mặt', icon: 'pi pi-money-bill' },
    { name: 'Chuyển khoản', icon: 'pi pi-qrcode' },
  ];
  readonly bank = environment.bank;
  readonly skeleton = Array.from({ length: 10 }, (_, i) => i);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly keyword = signal('');
  readonly category = signal<string | null>(null);

  readonly lines = signal<CartLine[]>([]);
  readonly method = signal('Tiền mặt');
  readonly given = signal<number | null>(null);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly receipt = signal<Receipt | null>(null);
  readonly queued = signal<{ id: number; until: string | null } | null>(null);

  readonly pending = signal<Draft | null>(null);
  readonly qrFailed = signal(false);

  readonly discount = signal(0);
  readonly promoName = signal<string | null>(null);
  private estimateSeq = 0;

  private readonly failed = signal<Set<number | string>>(new Set());

  // ---------- Tìm kiếm ----------

  private readonly index = computed<Indexed[]>(() =>
    this.products().map((p) => {
      const name = normalize(p.TenSanPham);
      return {
        p,
        name,
        words: name.split(/[^a-z0-9]+/).filter(Boolean),
        all: normalize(`${p.TenSanPham} ${p.TenThuongHieu ?? ''} ${p.LoaiSanPham ?? ''}`),
      };
    }),
  );

  /**
   * Thứ tự kết quả:
   * 0. tên bắt đầu bằng từ khóa
   * 1. có một từ trong tên bắt đầu bằng từ khóa
   * 2. tên chứa từ khóa ở giữa
   * 3. thương hiệu hoặc danh mục chứa từ khóa
   */
  private rank(it: Indexed, q: string, tokens: string[]): number | null {
    if (it.name.startsWith(q)) return 0;
    if (tokens.every((t) => it.words.some((w) => w.startsWith(t)))) return 1;
    if (tokens.every((t) => it.name.includes(t))) return 2;
    if (tokens.every((t) => it.all.includes(t))) return 3;
    return null;
  }

  // Đã lọc theo từ khóa, chưa lọc theo danh mục (để đếm số lượng mỗi danh mục)
  readonly base = computed<Product[]>(() => {
    const tokens = normalize(this.keyword()).split(/\s+/).filter(Boolean);
    const byName = (a: Product, b: Product) => a.TenSanPham.localeCompare(b.TenSanPham, 'vi');

    if (tokens.length === 0) {
      // Chưa gõ gì: theo tên A → Z, sản phẩm hết hàng xuống cuối
      return [...this.products()].sort(
        (a, b) => Number(this.stockOf(a) <= 0) - Number(this.stockOf(b) <= 0) || byName(a, b),
      );
    }

    const q = tokens.join(' ');
    const ranked: { p: Product; r: number }[] = [];
    for (const it of this.index()) {
      const r = this.rank(it, q, tokens);
      if (r !== null) ranked.push({ p: it.p, r });
    }
    return ranked.sort((a, b) => a.r - b.r || byName(a.p, b.p)).map((x) => x.p);
  });

  readonly chips = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.products()) counts.set(categoryOf(p), 0);
    for (const p of this.base()) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1);

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name.localeCompare(b.name, 'vi'),
      );
  });

  readonly filtered = computed(() => this.base());

  readonly firstAvailable = computed(() => this.filtered().find((p) => this.stockOf(p) > 0) ?? null);

  // ---------- Hóa đơn ----------

  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + this.price(l.product) * l.qty, 0),
  );
  readonly payable = computed(() => Math.max(this.total() - this.discount(), 0));
  readonly itemCount = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly cartQty = computed(() => new Map(this.lines().map((l) => [l.product.MaSanPham, l.qty])));

  // Gợi ý tiền khách đưa: vừa đủ và các mệnh giá làm tròn lên
  readonly quickCash = computed(() => {
    const p = this.payable();
    if (p <= 0) return [];
    const set = new Set<number>([p]);
    for (const d of [10000, 20000, 50000, 100000, 200000, 500000]) set.add(Math.ceil(p / d) * d);
    return [...set].sort((a, b) => a - b).slice(0, 4);
  });

  readonly canPay = computed(() => {
    if (this.lines().length === 0 || this.busy()) return false;
    const g = this.given();
    return this.method() !== 'Tiền mặt' || g === null || g >= this.payable();
  });

  readonly qrUrl = computed(() => {
    const draft = this.pending();
    if (!draft) return '';
    const b = environment.bank;
    const params = new URLSearchParams({
      amount: String(Math.round(draft.total)),
      addInfo: `HD${draft.id}`,
      accountName: b.accountName,
    });
    return `https://img.vietqr.io/image/${b.bankId}-${b.accountNo}-compact2.png?${params}`;
  });

  constructor() {
    this.loadProducts();
    // Máy có chuột/bàn phím thì tự đặt con trỏ vào ô tìm kiếm (máy cảm ứng thì không, tránh bật bàn phím ảo)
    afterNextRender(() => {
      if (window.matchMedia?.('(pointer: fine)').matches) this.focusSearch();
    });
  }

  // ---------- Hiển thị sản phẩm ----------

  price(p: Product): number {
    return Number(p.DonGiaBan);
  }

  stockOf(p: Product): number {
    return p.SoLuongBanDuoc ?? p.SoLuongHienTai;
  }

  stockLabel(p: Product): string {
    return this.stockOf(p) > 0 ? `Còn ${this.stockOf(p)}` : 'Hết hàng';
  }

  stockClass(p: Product): string {
    const s = this.stockOf(p);
    if (s <= 0) return 'text-slate-400';
    return s <= Number(p.TonKhoToiThieu ?? 0) ? 'font-medium text-amber-600' : 'text-slate-500';
  }

  showImage(p: Product): boolean {
    return !!p.hinh_anh_url && !this.failed().has(p.MaSanPham);
  }

  markFailed(p: Product) {
    this.failed.update((s) => new Set(s).add(p.MaSanPham));
  }

  initial(p: Product): string {
    return (p.TenSanPham.trim().charAt(0) || '?').toUpperCase();
  }

  color(p: Product): string {
    return COLORS[Math.abs(Number(p.MaSanPham) || 0) % COLORS.length];
  }

  // ---------- Tìm kiếm: thao tác ----------

  clearSearch() {
    this.keyword.set('');
    this.focusSearch();
  }

  clearFilters() {
    this.keyword.set('');
    this.category.set(null);
  }

  private focusSearch() {
    document.getElementById('search')?.focus();
  }

  // Nhấn Enter: thêm sản phẩm đầu tiên còn hàng rồi xóa từ khóa để nhập món tiếp theo
  addFirst() {
    const p = this.firstAvailable();
    if (!p) {
      this.error.set('Không có sản phẩm còn hàng phù hợp với từ khóa.');
      return;
    }
    if (this.add(p)) {
      this.keyword.set('');
      this.focusSearch();
    }
  }

  // ---------- Giỏ hàng ----------

  add(p: Product, qty = 1): boolean {
    const stock = this.stockOf(p);
    if (stock <= 0) {
      this.error.set(`"${p.TenSanPham}" đã hết hàng.`);
      return false;
    }

    const existing = this.lines().find((l) => l.product.MaSanPham === p.MaSanPham);
    const newQty = (existing?.qty ?? 0) + qty;
    if (newQty > stock) {
      this.error.set(`Chỉ còn ${stock} "${p.TenSanPham}" trong kho.`);
      return false;
    }

    this.error.set(null);
    this.receipt.set(null);
    this.queued.set(null);
    this.lines.update((ls) =>
      existing
        ? ls.map((l) => (l.product.MaSanPham === p.MaSanPham ? { ...l, qty: newQty } : l))
        : [...ls, { product: p, qty }],
    );
    this.refreshEstimate();
    return true;
  }

  change(line: CartLine, delta: number) {
    const q = line.qty + delta;
    if (q < 1) return this.remove(line);

    const stock = this.stockOf(line.product);
    if (q > stock) {
      this.error.set(`Chỉ còn ${stock} "${line.product.TenSanPham}" trong kho.`);
      return;
    }

    this.error.set(null);
    this.lines.update((ls) =>
      ls.map((l) => (l.product.MaSanPham === line.product.MaSanPham ? { ...l, qty: q } : l)),
    );
    this.refreshEstimate();
  }

  // Gõ trực tiếp số lượng trong hóa đơn
  setQty(line: CartLine, e: Event) {
    const input = e.target as HTMLInputElement;
    const raw = Math.floor(Number(input.value));

    if (!Number.isFinite(raw) || raw < 1) {
      input.value = String(line.qty);
      return;
    }

    const stock = this.stockOf(line.product);
    const q = Math.min(raw, stock);
    this.error.set(raw > stock ? `Chỉ còn ${stock} "${line.product.TenSanPham}" trong kho.` : null);
    input.value = String(q);

    this.lines.update((ls) =>
      ls.map((l) => (l.product.MaSanPham === line.product.MaSanPham ? { ...l, qty: q } : l)),
    );
    this.refreshEstimate();
  }

  remove(line: CartLine) {
    this.lines.update((ls) => ls.filter((l) => l.product.MaSanPham !== line.product.MaSanPham));
    this.refreshEstimate();
  }

  async clearCart() {
    if (this.lines().length === 0) return;
    const ok = await this.confirmDialog.ask({
      title: 'Xóa hết sản phẩm',
      message: 'Xóa tất cả sản phẩm trong hóa đơn hiện tại?',
      confirmLabel: 'Xóa hết',
      tone: 'warn',
    });
    if (!ok) return;

    this.lines.set([]);
    this.error.set(null);
    this.refreshEstimate();
  }

  onGiven(v: string) {
    this.given.set(v === '' ? null : Number(v));
  }

  // Ước tính giảm giá để hiển thị. Số tiền cuối cùng do máy chủ tính khi lập hóa đơn.
  private refreshEstimate() {
    const seq = ++this.estimateSeq;
    const total = this.total();
    if (total <= 0) {
      this.discount.set(0);
      this.promoName.set(null);
      return;
    }
    this.promoService.estimate(total).subscribe({
      next: (e) => {
        if (seq !== this.estimateSeq) return;
        this.discount.set(e.giam);
        this.promoName.set(e.chuong_trinh);
      },
      error: () => {
        if (seq !== this.estimateSeq) return;
        this.discount.set(0);
        this.promoName.set(null);
      },
    });
  }

  // ---------- Thanh toán ----------

  pay() {
    const lines = this.lines().map((l) => ({ name: l.product.TenSanPham, qty: l.qty }));
    const method = this.method();
    this.busy.set(true);
    this.error.set(null);

    if (method === 'Chuyển khoản') {
      this.sales.createDraft(lines).subscribe({
        next: (draft) => {
          this.busy.set(false);
          this.qrFailed.set(false);
          this.pending.set(draft);
        },
        error: (e) => this.fail(e),
      });
      return;
    }

    const given = this.given();
    this.sales.checkout(lines, method).subscribe({
      next: (invoice) => this.done(invoice, method, given),
      error: (e) => this.fail(e),
    });
  }

  confirmTransfer() {
    const draft = this.pending();
    if (!draft) return;
    this.busy.set(true);
    this.error.set(null);

    this.sales.pay(draft.id, 'Chuyển khoản', null).subscribe({
      next: (invoice) => {
        this.pending.set(null);
        this.done(invoice, 'Chuyển khoản', null);
      },
      error: (e) => {
        this.pending.set(null);
        this.sales.cancelDraft(draft.id).subscribe();
        this.fail(e);
      },
    });
  }

  cancelTransfer() {
    const draft = this.pending();
    if (draft) this.sales.cancelDraft(draft.id).subscribe();
    this.pending.set(null);
  }

  // ---------- Hàng đợi ----------

  holdInvoice() {
    const lines = this.lines().map((l) => ({ name: l.product.TenSanPham, qty: l.qty }));
    this.busy.set(true);
    this.error.set(null);

    this.sales
      .createDraft(lines)
      .pipe(
        switchMap((draft) =>
          this.sales.hold(draft.id).pipe(
            catchError((err) =>
              this.sales.cancelDraft(draft.id).pipe(switchMap(() => throwError(() => err))),
            ),
          ),
        ),
      )
      .subscribe({
        next: (inv) => this.afterHold(inv),
        error: (e) => this.fail(e),
      });
  }

  // Dùng trong hộp QR khi khách chưa chuyển khoản
  holdPending() {
    const draft = this.pending();
    if (!draft) return;
    this.busy.set(true);
    this.error.set(null);

    this.sales.hold(draft.id).subscribe({
      next: (inv) => {
        this.pending.set(null);
        this.afterHold(inv);
      },
      error: (e) => {
        this.pending.set(null);
        this.sales.cancelDraft(draft.id).subscribe();
        this.fail(e);
      },
    });
  }

  private afterHold(inv: { MaHoaDon: number; HanThanhToan?: string | null }) {
    this.busy.set(false);
    this.queued.set({ id: inv.MaHoaDon, until: inv.HanThanhToan ?? null });
    this.receipt.set(null);
    this.lines.set([]);
    this.refreshEstimate();
    this.given.set(null);
    this.loadProducts();
  }

  private done(
    invoice: { MaHoaDon: number; TongTien: number | string; TienGiamGia?: number | string | null },
    method: string,
    given: number | null,
  ) {
    this.busy.set(false);
    this.receipt.set({
      id: invoice.MaHoaDon,
      total: Number(invoice.TongTien), // số phải trả do máy chủ tính
      discount: Number(invoice.TienGiamGia ?? 0),
      method,
      given,
    });
    this.queued.set(null);
    this.lines.set([]);
    this.refreshEstimate();
    this.given.set(null);
    this.loadProducts();
  }

  private fail(e: HttpErrorResponse) {
    this.busy.set(false);
    this.error.set(e.error?.message ?? 'Không tạo được hóa đơn, vui lòng thử lại.');
    this.loadProducts();
  }

  newInvoice() {
    this.receipt.set(null);
    this.focusSearch();
  }

  private loadProducts() {
    this.productService.getAll().subscribe({
      next: (data) => {
        this.products.set((data ?? []).filter((p) => Number(p.TrangThai ?? 1) === 1));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Không tải được danh sách sản phẩm.');
      },
    });
  }
}
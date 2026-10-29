import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { SalesService } from './sales.service';

import { HttpErrorResponse } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { environment } from '../../../environments/environment';
import { Draft } from './sales.service';

interface CartLine {
  product: Product;
  qty: number;
}

interface Receipt {
  id: number;
  total: number;
  method: string;
  given: number | null;
}

// Bỏ dấu để gõ "nuoc" vẫn ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-sales',
  imports: [FormsModule, DecimalPipe, AutoCompleteModule, ButtonModule, InputTextModule, DialogModule],
  template: `
    <h1 class="mb-4 text-2xl font-semibold text-slate-800">Bán hàng</h1>

    @if (receipt(); as r) {
      <div class="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">
        <div class="font-semibold">Thanh toán thành công, hóa đơn #{{ r.id }}</div>
        <div class="mt-1 text-sm">
          Tổng tiền: <b>{{ r.total | number: '1.0-0' }} ₫</b> ({{ r.method }})
          @if (r.method === 'Tiền mặt' && r.given !== null) {
            · Khách đưa {{ r.given | number: '1.0-0' }} ₫ · Tiền thừa
            <b>{{ r.given - r.total | number: '1.0-0' }} ₫</b>
          }
        </div>
        <p-button label="Hóa đơn mới" icon="pi pi-plus" size="small" class="mt-3" (onClick)="newInvoice()" />
      </div>
    }

    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Cột trái: tìm sản phẩm + giỏ hàng -->
      <div class="space-y-4 lg:col-span-2">
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-64 flex-1">
              <label class="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm</label>
              <p-autocomplete
                inputId="search"
                [(ngModel)]="selected"
                [suggestions]="suggestions()"
                (completeMethod)="search($event)"
                (onSelect)="qtyInput.focus(); qtyInput.select()"
                optionLabel="TenSanPham"
                [minQueryLength]="1"
                placeholder="Gõ một từ, ví dụ: nuoc, mi, snack..."
                styleClass="w-full"
                inputStyleClass="w-full"
              >
                <ng-template #item let-p>
                  <div class="flex w-full items-center justify-between gap-4">
                    <div>
                      <div class="font-medium">{{ p.TenSanPham }}</div>
                      <div class="text-xs text-slate-500">{{ p.TenThuongHieu ?? '' }}</div>
                    </div>
                    <div class="text-right text-sm">
                      <div>{{ p.DonGiaBan | number: '1.0-0' }} ₫</div>
                      <div [class]="p.SoLuongHienTai > 0 ? 'text-slate-500' : 'text-red-600'">
                        {{ p.SoLuongHienTai > 0 ? 'Còn ' + p.SoLuongHienTai : 'Hết hàng' }}
                      </div>
                    </div>
                  </div>
                </ng-template>
              </p-autocomplete>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Số lượng</label>
              <input
                #qtyInput
                pInputText
                type="number"
                min="1"
                class="w-24"
                [(ngModel)]="qty"
                (keydown.enter)="add()"
              />
            </div>

            <p-button label="Thêm" icon="pi pi-plus" (onClick)="add()" />
          </div>
        </div>

        <div class="rounded-xl bg-white p-4 shadow-sm">
          @if (lines().length === 0) {
            <p class="py-8 text-center text-slate-500">Chưa có sản phẩm nào trong hóa đơn.</p>
          } @else {
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-slate-500">
                  <th class="py-2">Sản phẩm</th>
                  <th class="text-right">Đơn giá</th>
                  <th class="text-center">Số lượng</th>
                  <th class="text-right">Thành tiền</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lines(); track l.product.MaSanPham) {
                  <tr class="border-b border-slate-100">
                    <td class="py-2 font-medium text-slate-800">{{ l.product.TenSanPham }}</td>
                    <td class="text-right">{{ l.product.DonGiaBan | number: '1.0-0' }}</td>
                    <td class="text-center">
                      <div class="inline-flex items-center gap-1">
                        <p-button icon="pi pi-minus" size="small" [text]="true" (onClick)="change(l, -1)" />
                        <span class="w-8 text-center">{{ l.qty }}</span>
                        <p-button icon="pi pi-plus" size="small" [text]="true" (onClick)="change(l, 1)" />
                      </div>
                    </td>
                    <td class="text-right">{{ price(l.product) * l.qty | number: '1.0-0' }}</td>
                    <td class="text-right">
                      <p-button icon="pi pi-trash" size="small" severity="danger" [text]="true" (onClick)="remove(l)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <!-- Cột phải: thanh toán -->
      <div class="h-fit space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-baseline justify-between">
          <span class="text-slate-600">Tạm tính</span>
          <span class="text-2xl font-semibold text-slate-800">{{ total() | number: '1.0-0' }} ₫</span>
        </div>

        <div>
          <div class="mb-2 text-sm font-medium text-slate-700">Phương thức thanh toán</div>
          <div class="flex gap-2">
            @for (m of methods; track m) {
              <p-button [label]="m" size="small" [outlined]="method() !== m" (onClick)="method.set(m)" />
            }
          </div>
        </div>

        @if (method() === 'Tiền mặt') {
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Khách đưa (₫)</label>
            <input
              pInputText
              type="number"
              min="0"
              class="w-full"
              [ngModel]="given()"
              (ngModelChange)="given.set($event)"
            />
            @if (given() !== null && given()! >= total() && total() > 0) {
              <div class="mt-1 text-sm text-slate-600">
                Tiền thừa: <b>{{ given()! - total() | number: '1.0-0' }} ₫</b>
              </div>
            }
            @if (given() !== null && given()! < total()) {
              <div class="mt-1 text-sm text-red-600">Khách đưa chưa đủ.</div>
            }
          </div>
        }

        <p-button
          [label]="method() === 'Chuyển khoản' ? 'Hiện mã QR' : 'Thanh toán'"
          icon="pi pi-check"
          styleClass="w-full"
          [disabled]="!canPay()"
          [loading]="busy() && !pending()"
          (onClick)="pay()"
        />
        <p class="text-xs text-slate-500">
          Giá và tổng tiền cuối cùng do máy chủ tính khi thanh toán.
        </p>
      </div>
    </div>
    
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
        <p-button label="Đã nhận tiền" icon="pi pi-check" [loading]="busy()" (onClick)="confirmTransfer()" />
      </ng-template>
    </p-dialog>
  `,
})
export class Sales {
  private productService = inject(ProductService);
  private sales = inject(SalesService);

  readonly methods = ['Tiền mặt', 'Chuyển khoản'];

  readonly products = signal<Product[]>([]);
  readonly suggestions = signal<Product[]>([]);
  readonly selected = signal<Product | string | null>(null);
  readonly qty = signal(1);

  readonly lines = signal<CartLine[]>([]);
  readonly method = signal('Tiền mặt');
  readonly given = signal<number | null>(null);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly receipt = signal<Receipt | null>(null);

  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + this.price(l.product) * l.qty, 0),
  );

  readonly bank = environment.bank;
  readonly pending = signal<Draft | null>(null);
  readonly txCode = signal('');
  readonly qrFailed = signal(false);

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

  readonly canPay = computed(() => {
    if (this.lines().length === 0 || this.busy()) return false;
    const g = this.given();
    return this.method() !== 'Tiền mặt' || g === null || g >= this.total();
  });

  constructor() {
    this.loadProducts();
  }

  price(p: Product): number {
    return Number(p.DonGiaBan);
  }

  search(e: AutoCompleteCompleteEvent) {
    const words = normalize(e.query.trim()).split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      this.suggestions.set([]);
      return;
    }
    this.suggestions.set(
      this.products()
        .filter((p) => {
          const name = normalize(p.TenSanPham);
          return words.every((w) => name.includes(w));
        })
        .slice(0, 8),
    );
  }

  add() {
    const p = this.selected();
    if (!p || typeof p === 'string') {
      this.error.set('Hãy chọn một sản phẩm trong danh sách gợi ý.');
      return;
    }
    const qty = Math.floor(Number(this.qty()));
    if (!qty || qty < 1) {
      this.error.set('Số lượng phải từ 1 trở lên.');
      return;
    }

    const existing = this.lines().find((l) => l.product.MaSanPham === p.MaSanPham);
    const newQty = (existing?.qty ?? 0) + qty;
    if (newQty > p.SoLuongHienTai) {
      this.error.set(`Chỉ còn ${p.SoLuongHienTai} "${p.TenSanPham}" trong kho.`);
      return;
    }

    this.error.set(null);
    this.receipt.set(null);
    this.lines.update((ls) =>
      existing
        ? ls.map((l) => (l === existing ? { ...l, qty: newQty } : l))
        : [...ls, { product: p, qty }],
    );

    // Quay lại ô tìm kiếm để nhập món tiếp theo
    this.selected.set(null);
    this.qty.set(1);
    setTimeout(() => document.getElementById('search')?.focus());
  }

  change(line: CartLine, delta: number) {
    const q = line.qty + delta;
    if (q < 1) return this.remove(line);
    if (q > line.product.SoLuongHienTai) {
      this.error.set(`Chỉ còn ${line.product.SoLuongHienTai} "${line.product.TenSanPham}" trong kho.`);
      return;
    }
    this.error.set(null);
    this.lines.update((ls) => ls.map((l) => (l === line ? { ...l, qty: q } : l)));
  }

  remove(line: CartLine) {
    this.lines.update((ls) => ls.filter((l) => l !== line));
  }

  pay() {
    const lines = this.lines().map((l) => ({ name: l.product.TenSanPham, qty: l.qty }));
    const method = this.method();
    this.busy.set(true);
    this.error.set(null);

    if (method === 'Chuyển khoản') {
      this.sales.createDraft(lines).subscribe({
        next: (draft) => {
          this.busy.set(false);
          this.txCode.set('');
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

    this.sales.pay(draft.id, 'Chuyển khoản', this.txCode().trim() || null).subscribe({
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

  private done(invoice: { MaHoaDon: number; TongTien: number | string }, method: string, given: number | null) {
    this.busy.set(false);
    this.receipt.set({
      id: invoice.MaHoaDon,
      total: Number(invoice.TongTien), // tổng tiền do máy chủ tính
      method,
      given,
    });
    this.lines.set([]);
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
    setTimeout(() => document.getElementById('search')?.focus());
  }

  private loadProducts() {
    this.productService.getAll().subscribe({
      next: (data) => this.products.set(data),
      error: () => this.error.set('Không tải được danh sách sản phẩm.'),
    });
  }
}
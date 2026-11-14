import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { Product, ProductPayload, Supplier } from './product.model';
import { ProductService } from './product.service';
import { Observable, of } from 'rxjs';
import { Category } from '../categories/category.model';
import { CategoryService } from '../categories/category.service';
import { Lot, lotSeverity, lotText } from '../lots/lot.model';
import { LotService } from '../lots/lot.service';
import { DatePipe } from '@angular/common';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const num = (v: number | null | undefined) => (v == null ? null : Number(v));
const text = (v: string | null | undefined) => (v ?? '').trim() || null;

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule, TableModule, TagModule, ButtonModule,
    DialogModule, InputTextModule, DecimalPipe, DatePipe],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Sản phẩm</h1>
        <p class="text-sm text-slate-500">{{ filtered().length }} / {{ products().length }} sản phẩm</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          pInputText
          type="text"
          placeholder="Tìm theo tên hoặc mã sản phẩm..."
          class="w-72"
          [value]="keyword()"
          (input)="keyword.set($any($event.target).value)"
        />
        @if (canEdit()) {
          <p-button label="Thêm sản phẩm" icon="pi pi-plus" (onClick)="openCreate()" />
        }
      </div>
    </div>
    <div class="mb-3 flex flex-wrap gap-2">
  <button type="button" class="rounded-lg px-4 py-1.5 text-sm font-medium"
    [class]="hsdFilter() === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
    (click)="hsdFilter.set('all')">Tất cả</button>
  <button type="button" class="rounded-lg px-4 py-1.5 text-sm font-medium"
    [class]="hsdFilter() === 'sap_het_han' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
    (click)="hsdFilter.set('sap_het_han')">Sắp hết hạn ({{ hsdCounts().sap }})</button>
  <button type="button" class="rounded-lg px-4 py-1.5 text-sm font-medium"
    [class]="hsdFilter() === 'het_han' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
    (click)="hsdFilter.set('het_han')">Đã hết hạn ({{ hsdCounts().het }})</button>
</div>
    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="rounded-xl bg-white p-2 shadow-sm">
      <p-table
        [value]="filtered()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="MaSanPham"
        [tableStyle]="{ 'min-width': '50rem' }"
        [expandedRowKeys]="expanded()"
      >
        <ng-template #header>
          <tr>
            <th>Mã</th>
            <th>Tên sản phẩm</th>
            <th>Loại</th>
            @if (canEdit()) {
              <th class="text-right">Giá nhập</th>
            }
            <th class="text-right">Giá bán</th>
            <th class="text-right">Tồn kho</th>
            <th>Hạn dùng</th>
            <th>Trạng thái</th>
            
            @if (canEdit()) {
  <th class="text-right">Thao tác</th>
}
            
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr>
            <td>{{ p.MaSanPham }}</td>
            <td>
  <div class="flex items-center gap-3">
    <div class="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      @if (p.hinh_anh_url) {
        <img [src]="p.hinh_anh_url" alt="" class="h-full w-full object-cover" />
      }
    </div>
    <div>
      <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
      @if (p.TenThuongHieu) {
        <div class="text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
      }
    </div>
  </div>
</td>
            <td>{{ p.LoaiSanPham ?? '—' }}</td>
            @if (canEdit()) {
              <td class="text-right">{{ p.DonGiaNhap | number: '1.0-0' }} ₫</td>
            }
            <td class="text-right">{{ p.DonGiaBan | number: '1.0-0' }} ₫</td>
            <td class="text-right">{{ p.SoLuongHienTai }}</td>
            <td>
  @if (p.han_gan_nhat) {
    <div class="flex flex-col items-start gap-0.5">
      <p-tag [value]="hsdText(p)" [severity]="hsdSeverity(p)" />
      <span class="text-xs text-slate-500">{{ p.han_gan_nhat | date: 'dd/MM/yyyy' }}</span>
    </div>
  } @else {
    <span class="text-xs text-slate-400">Không có hạn</span>
  }
  @if ((p.so_luong_het_han ?? 0) > 0) {
    <div class="text-xs text-red-600">{{ p.so_luong_het_han }} sản phẩm đã hết hạn</div>
  }
  <button type="button" class="mt-1 text-xs text-emerald-600 underline" (click)="toggleLots(p)">
    {{ expanded()[p.MaSanPham] ? 'Ẩn các lô' : 'Xem ' + (p.lo_hang?.length ?? 0) + ' lô' }}
  </button>
</td>
            <td><p-tag [value]="stock(p).label" [severity]="stock(p).severity" /></td>
            @if (canEdit()) {
              <td class="text-right">
  <div class="flex justify-end gap-1">

    @if (canEdit()) {
  <td class="text-right">
    <div class="flex justify-end gap-1">
      <p-button label="Sửa" size="small" [text]="true" (onClick)="openEdit(p)" />
      @if (isHidden(p)) {
        <p-button label="Hiện lại" size="small" severity="success" [text]="true" [disabled]="busy()" (onClick)="restore(p)" />
      } @else {
        <p-button label="Xóa" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="remove(p)" />
      }
    </div>
  </td>
}
  </div>
</td>
            }
          </tr>
        </ng-template>
        <ng-template #expandedrow let-p>
  <tr>
    <td [attr.colspan]="canEdit() ? 9 : 7" class="bg-slate-50 px-6 py-3">
      <div class="mb-2 text-sm font-medium text-slate-700">
        Các lô còn hàng của {{ p.TenSanPham }}
        @if (p.TienToLo) {
          <span class="font-normal text-slate-400">· tiền tố {{ p.TienToLo }}</span>
        }
      </div>

      @if (p.lo_hang?.length) {
        <table class="w-full max-w-3xl text-sm">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-1">Mã lô</th>
              <th>Ngày nhập</th>
              <th>Hạn sử dụng</th>
              <th class="text-right">Còn lại / Nhập</th>
              <th class="pl-4">Tình trạng</th>
              @if (canEdit()) {
                <th></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of p.lo_hang; track l.MaLoHang) {
              <tr class="border-b border-slate-100">
                <td class="py-1 font-medium text-slate-800">{{ l.MaLo }}</td>
                <td>{{ l.NgayNhap | date: 'dd/MM/yyyy' }}</td>
                <td>{{ l.HanSuDung ? (l.HanSuDung | date: 'dd/MM/yyyy') : '—' }}</td>
                <td class="text-right">{{ l.SoLuongCon }} / {{ l.SoLuongNhap }}</td>
                <td class="pl-4"><p-tag [value]="lotText(l)" [severity]="lotSeverity(l.trang_thai)" /></td>
                @if (canEdit()) {
                  <td class="text-right">
                    <p-button label="Đặt hạn" size="small" [text]="true" (onClick)="openLotExpiry(l)" />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="text-sm text-slate-500">Chưa có lô nào còn hàng.</p>
      }
    </td>
  </tr>
</ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="8" class="py-8 text-center text-slate-500">Không có sản phẩm nào.</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Sửa sản phẩm' : 'Thêm sản phẩm'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [style]="{ width: '42rem' }"
    >
      <form [formGroup]="form" class="space-y-3">
        @if (formError()) {
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError() }}</div>
        }

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
          <input pInputText formControlName="TenSanPham" class="w-full" />
        </div>
        <div>
  <label class="mb-1 block text-sm font-medium text-slate-700">Tiền tố mã lô</label>
  <input pInputText formControlName="TienToLo" class="w-full uppercase" maxlength="10" placeholder="Để trống: tự tạo từ tên sản phẩm" />
  <small class="text-slate-500">
    Mã lô có dạng <b>{{ form.controls.TienToLo.value || 'A' }}-001</b>, tăng dần mỗi lần nhập hàng. Không đổi được khi sản phẩm đã có lô.
  </small>
</div>

        <div class="grid grid-cols-2 gap-3">
          <div>
  <label class="mb-1 block text-sm font-medium text-slate-700">Danh mục *</label>
  <select formControlName="MaDanhMuc" class="w-full rounded-md border border-slate-300 px-3 py-2">
    <option [ngValue]="null" disabled>-- Chọn danh mục --</option>
    @for (c of categories(); track c.MaDanhMuc) {
      <option [ngValue]="c.MaDanhMuc">{{ c.TenDanhMuc }}</option>
    }
  </select>
</div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Thương hiệu</label>
            <input pInputText formControlName="TenThuongHieu" class="w-full" />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Nhà cung cấp *</label>
          <select formControlName="MaNhaCungCap" class="w-full rounded-md border border-slate-300 px-3 py-2">
            <option [ngValue]="null" disabled>-- Chọn nhà cung cấp --</option>
            @for (s of supplierOptions(); track s.MaNhaCungCap) {
              <option [ngValue]="s.MaNhaCungCap">{{ s.TenNhaCungCap }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Giá nhập (₫) *</label>
            <input pInputText type="number" min="0" formControlName="DonGiaNhap" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Giá bán (₫) *</label>
            <input pInputText type="number" min="0" formControlName="DonGiaBan" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Tồn tối thiểu *</label>
            <input pInputText type="number" min="0" formControlName="TonKhoToiThieu" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Tồn tối đa</label>
            <input pInputText type="number" min="0" formControlName="TonKhoToiDa" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Cảnh báo HSD (ngày)</label>
            <input pInputText type="number" min="0" formControlName="CanhBaoHSD" class="w-full" />
          </div>
        </div>
        @if (form.hasError('maxLtMin')) {
          <small class="text-red-600">Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.</small>
        }

        @if (editing(); as e) {
          <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Tồn kho hiện tại: <b>{{ e.SoLuongHienTai }}</b>. Muốn đổi số lượng, dùng chức năng cập nhật tồn kho để có lịch sử.
          </div>
        } @else {
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Số lượng ban đầu</label>
            <input pInputText type="number" min="0" formControlName="SoLuongHienTai" class="w-full" />
          </div>
          <div>
  <label class="mb-1 block text-sm font-medium text-slate-700">Hạn sử dụng của số lượng ban đầu</label>
  <input pInputText type="date" formControlName="HanSuDungBanDau" class="w-full" />
  <small class="text-slate-500">Để trống nếu sản phẩm không có hạn sử dụng.</small>
</div>
        }
        <div>
  
  <div>
  <label class="mb-1 block text-sm font-medium text-slate-700">Ảnh sản phẩm</label>

  <div class="flex items-start gap-4">
    <label
      class="group relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-emerald-500 hover:bg-emerald-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200"
      title="Bấm để chọn ảnh"
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="sr-only"
        (change)="onFile($event)"
      />

      @if (imagePreview()) {
        <img [src]="imagePreview()" alt="Ảnh sản phẩm" class="h-full w-full object-cover" />
        <span
          class="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-xs text-white opacity-0 transition group-hover:opacity-100"
        >
          Bấm để đổi ảnh
        </span>
      } @else {
        <span class="flex flex-col items-center gap-1 px-2 text-center text-slate-400 group-hover:text-emerald-600">
          <i class="pi pi-image text-3xl"></i>
          <span class="text-xs font-medium">Bấm để chọn ảnh</span>
        </span>
      }
    </label>

    <div class="space-y-1 pt-1 text-xs text-slate-500">
      <p>JPG, PNG hoặc WebP, tối đa 2 MB.</p>
      @if (imagePreview()) {
        <button type="button" class="text-red-600 underline" (click)="clearImage()">Xóa ảnh</button>
      }
    </div>
  </div>
</div>
</div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea formControlName="MoTa" rows="2" class="w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Thành phần</label>
          <textarea formControlName="ThanhPhan" rows="2" class="w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="dialogOpen.set(false)" />
        <p-button
          label="Lưu"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="form.invalid || busy()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  <p-dialog
  header="Hạn sử dụng của lô"
  [modal]="true"
  [visible]="!!lotTarget()"
  (visibleChange)="!$event && lotTarget.set(null)"
  [style]="{ width: '24rem' }"
>
  @if (lotTarget(); as l) {
    <div class="space-y-3">
      @if (lotError()) {
        <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ lotError() }}</div>
      }
      <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm">Lô <b>{{ l.MaLo }}</b> · còn {{ l.SoLuongCon }}</div>
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700">Hạn sử dụng</label>
        <input
          type="date"
          class="w-full rounded-md border border-slate-300 px-3 py-2"
          [value]="lotDate()"
          (input)="lotDate.set($any($event.target).value)"
        />
        <small class="text-slate-500">Để trống nếu hàng không có hạn sử dụng.</small>
      </div>
    </div>
  }
  <ng-template #footer>
    <p-button label="Hủy" [text]="true" [disabled]="lotBusy()" (onClick)="lotTarget.set(null)" />
    <p-button label="Lưu" icon="pi pi-check" [loading]="lotBusy()" [disabled]="lotBusy()" (onClick)="saveLotExpiry()" />
  </ng-template>
</p-dialog>
  `,
})
export class ProductList {
  private service = inject(ProductService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly keyword = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly formError = signal<string | null>(null);

  // Chỉ chủ và quản lý được thêm / sửa (khớp route role:1,2 ở backend)
  readonly canEdit = computed(() => this.auth.hasAnyRole([ROLE.OWNER, ROLE.MANAGER]));

  private categoryService = inject(CategoryService);
  readonly categories = signal<Category[]>([]);

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    const f = this.hsdFilter();
    return this.products().filter(
      (p) =>
        (f === 'all' || p.trang_thai_hsd === f) &&
        (!k || normalize(p.TenSanPham).includes(k) || normalize(String(p.MaSanPham)).includes(k)),
    );
  });

  readonly form = this.fb.group(
    {
      TenSanPham: ['', Validators.required],
      MaDanhMuc: [null as number | null, Validators.required],
      TenThuongHieu: [''],
      MaNhaCungCap: [null as number | null, Validators.required],
      DonGiaNhap: [null as number | null, [Validators.required, Validators.min(0)]],
      DonGiaBan: [null as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiThieu: [0 as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiDa: [null as number | null],
      CanhBaoHSD: [null as number | null],
      SoLuongHienTai: [0 as number | null, Validators.min(0)],
      MoTa: [''],
      ThanhPhan: [''],
      TienToLo: [''], HanSuDungBanDau: [''],
    },
    {
      validators: (g) => {
        const min = g.get('TonKhoToiThieu')?.value;
        const max = g.get('TonKhoToiDa')?.value;
        return max != null && min != null && Number(max) < Number(min) ? { maxLtMin: true } : null;
      },
    },
  );
  readonly supplierOptions = computed(() => {
    const current = Number(this.editing()?.MaNhaCungCap ?? 0);
    return this.suppliers().filter(
      (s) => Number(s.TrangThai ?? 1) === 1 || s.MaNhaCungCap === current,
    );
  });

  readonly stockTarget = signal<Product | null>(null);
  readonly stockBusy = signal(false);
  readonly stockError = signal<string | null>(null);
  readonly reasons = ['Kiểm kho', 'Hàng hỏng', 'Hàng hết hạn', 'Thất thoát', 'Điều chỉnh số liệu'];

  readonly stockForm = this.fb.nonNullable.group({
    SoLuongMoi: [0, [Validators.required, Validators.min(0)]],
    LyDoCapNhat: ['', [Validators.required, Validators.maxLength(255)]],
  });
  private lotService = inject(LotService);

  readonly lotText = lotText;
  readonly lotSeverity = lotSeverity;

  readonly hsdFilter = signal<'all' | 'sap_het_han' | 'het_han'>('all');
  readonly expanded = signal<Record<string, boolean>>({});

  readonly lotTarget = signal<Lot | null>(null);
  readonly lotDate = signal('');
  readonly lotBusy = signal(false);
  readonly lotError = signal<string | null>(null);

  readonly hsdCounts = computed(() => ({
    sap: this.products().filter((p) => p.trang_thai_hsd === 'sap_het_han').length,
    het: this.products().filter((p) => p.trang_thai_hsd === 'het_han').length,
  }));

  hsdText(p: Product): string {
    return lotText({ trang_thai: p.trang_thai_hsd ?? 'khong_han', so_ngay_con_lai: p.so_ngay_hsd ?? null });
  }

  hsdSeverity(p: Product) {
    return lotSeverity(p.trang_thai_hsd ?? 'khong_han');
  }

  toggleLots(p: Product) {
    const key = String(p.MaSanPham);
    this.expanded.update((e) => {
      const next = { ...e };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  openLotExpiry(l: Lot) {
    this.lotTarget.set(l);
    this.lotDate.set(l.HanSuDung ?? '');
    this.lotError.set(null);
  }

  saveLotExpiry() {
    const l = this.lotTarget();
    if (!l) return;

    this.lotBusy.set(true);
    this.lotError.set(null);
    this.lotService.setExpiry(l.MaLoHang, this.lotDate() || null).subscribe({
      next: (res) => {
        this.lotBusy.set(false);
        this.lotTarget.set(null);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.lotBusy.set(false);
        this.lotError.set(this.errorText(e));
      },
    });
  }
  openStock(p: Product) {
    this.stockTarget.set(p);
    this.stockError.set(null);
    this.stockForm.reset({ SoLuongMoi: p.SoLuongHienTai, LyDoCapNhat: '' });
  }
  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly imageRemoved = signal(false);

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.formError.set('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.formError.set('Ảnh không được lớn hơn 2 MB.');
      return;
    }

    this.formError.set(null);
    this.revokePreview();
    this.imageFile.set(file);
    this.imageRemoved.set(false);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  clearImage() {
    this.revokePreview();
    this.imageFile.set(null);
    this.imageRemoved.set(true);
    this.imagePreview.set(null);
  }

  private resetImage(url: string | null) {
    this.revokePreview();
    this.imageFile.set(null);
    this.imageRemoved.set(false);
    this.imagePreview.set(url);
  }

  private revokePreview() {
    const url = this.imagePreview();
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  private saveImage(id: number | string): Observable<unknown> {
    const file = this.imageFile();
    if (file) return this.service.uploadImage(id, file);
    if (this.imageRemoved()) return this.service.removeImage(id);
    return of(null);
  }

  private finishSave(message: string) {
    this.busy.set(false);
    this.dialogOpen.set(false);
    this.notify(message);
    this.load();
  }
  diff(p: Product): number {
    const n = Number(this.stockForm.controls.SoLuongMoi.value);
    return Number.isFinite(n) ? Math.floor(n) - Number(p.SoLuongHienTai) : 0;
  }

  saveStock() {
    const p = this.stockTarget();
    if (!p || this.stockForm.invalid) return;

    const v = this.stockForm.getRawValue();
    const moi = Math.floor(Number(v.SoLuongMoi));
    if (moi === Number(p.SoLuongHienTai)) {
      this.stockError.set('Số lượng mới đang bằng số lượng hiện tại.');
      return;
    }

    this.stockBusy.set(true);
    this.stockError.set(null);
    this.service.updateStock(p.MaSanPham, moi, v.LyDoCapNhat.trim()).subscribe({
      next: (res) => {
        this.stockBusy.set(false);
        this.stockTarget.set(null);
        this.notify(res.message ?? 'Đã cập nhật tồn kho.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.stockBusy.set(false);
        this.stockError.set(this.errorText(e));
      },
    });
  }
  constructor() {
    this.load();
    if (this.canEdit()) {
      this.service.suppliers().subscribe({
        next: (s) => this.suppliers.set(s ?? []),
        error: () => this.error.set('Không tải được danh sách nhà cung cấp.'),
      });
      this.categoryService.list().subscribe({
        next: (c) => this.categories.set(c ?? []),
        error: () => this.error.set('Không tải được danh sách danh mục.'),
      });
    }
  }

  load() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  isHidden(p: Product) {
    return Number(p.TrangThai ?? 1) === 0;
  }
  stock(p: Product): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
    if (this.isHidden(p)) return { label: 'Đã ẩn', severity: 'secondary' };
    if (p.SoLuongHienTai <= 0) return { label: 'Hết hàng', severity: 'danger' };
    if (p.SoLuongHienTai <= p.TonKhoToiThieu) return { label: 'Sắp hết', severity: 'warn' };
    return { label: 'Còn hàng', severity: 'success' };
  }

  remove(p: Product) {
    if (
      !confirm(
        `Xóa sản phẩm "${p.TenSanPham}"?\nNếu sản phẩm đã có trong hóa đơn hoặc phiếu nhập, hệ thống chỉ ẩn nó.`,
      )
    )
      return;

    this.busy.set(true);
    this.service.remove(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }

  restore(p: Product) {
    this.busy.set(true);
    this.service.restore(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }
  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.resetImage(null);
    this.form.reset({
      TenSanPham: '', MaDanhMuc: null, TenThuongHieu: '', MaNhaCungCap: null,
      DonGiaNhap: null, DonGiaBan: null, TonKhoToiThieu: 0, TonKhoToiDa: null,
      CanhBaoHSD: null, SoLuongHienTai: 0, MoTa: '', ThanhPhan: '', TienToLo: '', HanSuDungBanDau: ''
    });
    this.dialogOpen.set(true);
  }

  openEdit(p: Product) {
    this.editing.set(p);
    this.formError.set(null);
    this.form.reset({
      TenSanPham: p.TenSanPham,
      MaDanhMuc: p.MaDanhMuc != null ? Number(p.MaDanhMuc) : null,
      TenThuongHieu: p.TenThuongHieu ?? '',
      TienToLo: p.TienToLo ?? '',
      HanSuDungBanDau: '',
      MaNhaCungCap: p.MaNhaCungCap != null ? Number(p.MaNhaCungCap) : null,
      DonGiaNhap: num(p.DonGiaNhap as number | null),
      DonGiaBan: num(p.DonGiaBan as number),
      TonKhoToiThieu: p.TonKhoToiThieu,
      TonKhoToiDa: p.TonKhoToiDa ?? null,
      CanhBaoHSD: p.CanhBaoHSD ?? null,
      SoLuongHienTai: p.SoLuongHienTai,
      MoTa: p.MoTa ?? '',
      ThanhPhan: p.ThanhPhan ?? '',
    });
    this.dialogOpen.set(true);
    this.resetImage(p.hinh_anh_url ?? null);
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const body: ProductPayload = {
      TenSanPham: (v.TenSanPham ?? '').trim(),
      MaDanhMuc: Number(v.MaDanhMuc),
      TenThuongHieu: text(v.TenThuongHieu),
      TienToLo: text(v.TienToLo)?.toUpperCase() ?? null,
      MaNhaCungCap: Number(v.MaNhaCungCap),
      DonGiaNhap: Number(v.DonGiaNhap),
      DonGiaBan: Number(v.DonGiaBan),
      TonKhoToiThieu: Number(v.TonKhoToiThieu ?? 0),
      TonKhoToiDa: num(v.TonKhoToiDa),
      CanhBaoHSD: num(v.CanhBaoHSD),
      MoTa: text(v.MoTa),
      ThanhPhan: text(v.ThanhPhan),
    };

    const current = this.editing();
    if (!current) {
      body.SoLuongHienTai = Number(v.SoLuongHienTai ?? 0);
      body.HanSuDungBanDau = v.HanSuDungBanDau || null;
    }

    const request = current
      ? this.service.update(current.MaSanPham, body)
      : this.service.create(body);

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: (res) => {
        const id = current?.MaSanPham ?? res.data.MaSanPham;
        this.saveImage(id).subscribe({
          next: () => this.finishSave(current ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.'),
          error: (e: HttpErrorResponse) =>
            this.finishSave(`Đã lưu sản phẩm nhưng chưa cập nhật được ảnh: ${this.errorText(e)}`),
        });
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  private notify(message: string) {
    this.success.set(message);
    this.error.set(null);
    setTimeout(() => this.success.set(null), 4000);
  }

  private errorText(e: HttpErrorResponse): string {
    const errs = e.error?.errors as Record<string, string[]> | undefined;
    if (errs) return Object.values(errs).flat().join(' ');
    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }

}
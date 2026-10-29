import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { Product } from './product.model';
import { ProductService } from './product.service';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-product-list',
  imports: [
    TableModule,
    TagModule,
    InputTextModule,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    TextareaModule
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Sản phẩm</h1>
        <p class="text-sm text-slate-500">{{ filtered().length }} / {{ products().length }} sản phẩm</p>
      </div>

      <input
        pInputText
        type="text"
        placeholder="Tìm theo tên hoặc mã sản phẩm..."
        class="w-72"
        [value]="keyword()"
        (input)="keyword.set($any($event.target).value)"
      />
    </div>

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
        [tableStyle]="{ 'min-width': '55rem' }"
      >
        <ng-template #header>
          <tr>
            <th>Mã</th>
            <th>Tên sản phẩm</th>
            <th>Loại</th>
            <th class="text-right">Giá bán</th>
            <th class="text-right">Tồn kho</th>
            <th>Trạng thái</th>
            <th class="text-center">Thao tác</th>
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr>
            <td>{{ p.MaSanPham }}</td>
            <td>
              <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
              @if (p.TenThuongHieu) {
                <div class="text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
              }
            </td>
            <td>{{ p.LoaiSanPham ?? '—' }}</td>
            <td class="text-right">{{ p.DonGiaBan | number: '1.0-0' }} ₫</td>
            <td class="text-right font-bold text-emerald-600">{{ p.SoLuongHienTai }}</td>
            <td>
              <p-tag [value]="stock(p).label" [severity]="stock(p).severity" />
            </td>
            <td class="text-center">
              <p-button 
                label="Cập nhật kho" 
                icon="pi pi-pencil" 
                severity="warn" 
                size="small" 
                (onClick)="moModalCapNhat(p)" 
              />
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-500">Không có sản phẩm nào.</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Modal Cập nhật tồn kho -->
    <p-dialog 
      header="Cập nhật tồn kho: {{ sanPhamDangChon?.TenSanPham }}" 
      [(visible)]="hienModal" 
      [modal]="true" 
      [style]="{width: '450px'}"
    >
      <div class="flex flex-col gap-4 py-2">
        <div>
          <label class="block text-sm font-medium mb-1 text-slate-600">Tồn kho hiện tại:</label>
          <input type="text" pInputText [value]="sanPhamDangChon?.SoLuongHienTai" disabled class="w-full bg-slate-100 font-bold" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 text-red-600 font-semibold">Số lượng tồn kho thực tế mới (*):</label>
          <input type="number" pInputText [(ngModel)]="soLuongMoi" min="0" class="w-full" placeholder="Nhập số lượng thực tế..." />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 text-red-600 font-semibold">Lý do cập nhật (*):</label>
          <textarea 
            pTextarea 
            [(ngModel)]="lyDoCapNhat" 
            rows="3" 
            class="w-full" 
            placeholder="Ví dụ: Kiểm kê định kỳ, hàng hỏng, điều chỉnh lệch kho...">
          </textarea>
        </div>

        <!-- Đưa các nút nằm gọn bên trong khung, ngay dưới ô nhập lý do -->
        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 mt-2">
          <p-button label="Hủy" icon="pi pi-times" severity="secondary" (onClick)="hienModal = false" />
          <p-button label="Xác nhận lưu" icon="pi pi-check" severity="success" (onClick)="thucHienCapNhat()" />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ProductList {
  private service = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly keyword = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Trạng thái cho modal cập nhật tồn kho
  hienModal: boolean = false;
  sanPhamDangChon: Product | null = null;
  soLuongMoi: number = 0;
  lyDoCapNhat: string = '';

  readonly filtered = computed(() => {
    const k = normalize(this.keyword().trim());
    if (!k) return this.products();
    return this.products().filter(
      (p) => normalize(p.TenSanPham).includes(k) || normalize(String(p.MaSanPham)).includes(k),
    );
  });

  constructor() {
    this.taiDanhSach();
  }

  taiDanhSach() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (data: any) => {
        this.products.set(data.data || data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  moModalCapNhat(p: Product) {
    this.sanPhamDangChon = p;
    this.soLuongMoi = p.SoLuongHienTai;
    this.lyDoCapNhat = '';
    this.hienModal = true;
  }

  thucHienCapNhat() {
    if (!this.sanPhamDangChon) return;

    if (this.soLuongMoi < 0) {
      alert('Số lượng mới không được nhỏ hơn 0!');
      return;
    }

    if (!this.lyDoCapNhat.trim()) {
      alert('Vui lòng nhập lý do cập nhật tồn kho!');
      return;
    }

    // Gọi hàm cập nhật tồn kho từ ProductService
    this.service.capNhatTonKho(this.sanPhamDangChon.MaSanPham, {
      SoLuongMoi: this.soLuongMoi,
      LyDoCapNhat: this.lyDoCapNhat
    }).subscribe({
      next: (res: any) => {
        alert(res.message || 'Cập nhật tồn kho thành công!');
        this.hienModal = false;
        this.taiDanhSach(); // Tải lại danh sách để cập nhật số lượng mới trên UI
      },
      error: (err: any) => {
        console.error('Lỗi cập nhật tồn kho', err);
        alert(err.error?.message || 'Có lỗi xảy ra khi cập nhật tồn kho!');
      }
    });
  }

  stock(p: Product): { label: string; severity: 'success' | 'warn' | 'danger' } {
    if (p.SoLuongHienTai <= 0) return { label: 'Hết hàng', severity: 'danger' };
    if (p.SoLuongHienTai <= p.TonKhoToiThieu) return { label: 'Sắp hết', severity: 'warn' };
    return { label: 'Còn hàng', severity: 'success' };
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { BillService } from './bill.service';
import { HoaDon, ChiTietHoaDon, SanPham } from './bill.model';

@Component({
  selector: 'app-bill-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule,
    InputTextModule, TagModule, CardModule
  ],
  template: `
    <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Cột trái: Thao tác hóa đơn hiện tại -->
      <div class="col-span-1">
        <p-card header="Quản lý Bán Hàng (POS)">
          <div class="mb-4">
            <p-button label="Tạo Hóa Đơn Nháp Mới" icon="pi pi-plus" severity="success" (onClick)="taoHoaDon()" styleClass="w-full" />
          </div>

          @if (hoaDonHienTai()) {
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
              <p class="font-semibold text-lg mb-2">Mã Hóa Đơn: #{{ hoaDonHienTai()?.MaHoaDon }}</p>
              <p class="mb-1">Ngày lập: {{ hoaDonHienTai()?.NgayLap | date:'short' }}</p>
              <p class="mb-1">Tổng tiền: <span class="font-bold text-red-600">{{ hoaDonHienTai()?.TongTien | number }} đ</span></p>
              <p class="mb-3">
                Trạng thái: 
                <p-tag [value]="hoaDonHienTai()?.TrangThaiHoaDon ? 'Đã thanh toán' : 'Chưa thanh toán'" 
                       [severity]="hoaDonHienTai()?.TrangThaiHoaDon ? 'success' : 'warn'" />
              </p>

              @if (!hoaDonHienTai()?.TrangThaiHoaDon) {
                <hr class="my-3 border-gray-300">
                <h4 class="font-semibold mb-2">Thêm sản phẩm vào hóa đơn</h4>
                
                <!-- Tìm kiếm sản phẩm -->
                <div class="mb-2 relative">
                  <label class="block text-sm font-medium mb-1">Tìm sản phẩm</label>
                  <input 
                    type="text" 
                    pInputText 
                    [(ngModel)]="tuKhoaTimKiem" 
                    (input)="onSearchInput()" 
                    placeholder="Gõ tên sản phẩm để tìm..." 
                    class="w-full" />

                  <!-- Danh sách gợi ý -->
                  @if (filteredSanPham().length > 0) {
                    <ul class="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                      @for (sp of filteredSanPham(); track sp.MaSanPham) {
                        <li 
                          (click)="chuyenChonSanPham(sp)" 
                          class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 flex justify-between items-center">
                          <span class="font-medium">{{ sp.TenSanPham }}</span>
                          <span class="text-gray-500 text-xs">{{ sp.DonGiaBan | number }} đ</span>
                        </li>
                      }
                    </ul>
                  }
                </div>

                <div class="mb-3">
                  <label class="block text-sm font-medium mb-1">Số lượng</label>
                  <input type="number" pInputText [(ngModel)]="soLuongInput" min="1" class="w-full" />
                </div>

                <p-button label="Thêm vào hóa đơn" icon="pi pi-cart-plus" (onClick)="themSanPham()" styleClass="w-full mb-3" />
                <p-button label="Thanh Toán Ngay" icon="pi pi-check-circle" severity="help" (onClick)="thanhToan()" styleClass="w-full" />
              }
            </div>
          } @else {
            <p class="text-gray-500 italic text-center py-6">Chưa có hóa đơn nào được chọn. Hãy bấm tạo mới hóa đơn nháp!</p>
          }
        </p-card>
      </div>

      <!-- Cột phải: Chi tiết sản phẩm & Lịch sử hóa đơn -->
      <div class="col-span-2 flex flex-col gap-6">
        
        <!-- Bảng chi tiết sản phẩm của hóa đơn hiện tại -->
        <p-card header="Chi Tiết Sản Phẩm Trong Hóa Đơn">
          <p-table [value]="danhSachChiTiet()" [paginator]="true" [rows]="4">
            <ng-template pTemplate="header">
              <tr>
                <th>Mã SP</th>
                <th>Tên sản phẩm</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>{{ item.MaSanPham }}</td>
                <td>{{ item.TenSanPham }}</td>
                <td>{{ item.SoLuong }}</td>
                <td>{{ item.ThanhTien | number }} đ</td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" class="text-center p-4 text-gray-500">Chưa có sản phẩm nào trong hóa đơn này.</td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <!-- Bảng danh sách lịch sử tất cả hóa đơn -->
        <p-card header="Lịch Sử Hóa Đơn Gần Đây">
          <p-table [value]="danhSachHoaDon()" [paginator]="true" [rows]="4">
            <ng-template pTemplate="header">
              <tr>
                <th>Mã HĐ</th>
                <th>Ngày lập</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-hd>
              <tr>
                <td class="font-bold">#{{ hd.MaHoaDon }}</td>
                <td>{{ hd.NgayLap | date:'short' }}</td>
                <td class="text-red-600 font-semibold">{{ hd.TongTien | number }} đ</td>
                <td>
                  <p-tag [value]="hd.TrangThaiHoaDon ? 'Đã thanh toán' : 'Chưa thanh toán'" 
                         [severity]="hd.TrangThaiHoaDon ? 'success' : 'warn'" />
                </td>
                <td>
                  <p-button label="Xem" icon="pi pi-eye" size="small" severity="secondary" (onClick)="chonHoaDonCu(hd)" />
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="text-center p-4 text-gray-500">Chưa có lịch sử hóa đơn nào.</td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

      </div>

    </div>
  `
})
export class BillList implements OnInit {
  private service = inject(BillService);

  hoaDonHienTai = signal<HoaDon | null>(null);
  danhSachChiTiet = signal<ChiTietHoaDon[]>([]);
  danhSachHoaDon = signal<HoaDon[]>([]);

  tuKhoaTimKiem: string = '';
  sanPhamDuocChon: SanPham | null = null;
  filteredSanPham = signal<SanPham[]>([]);
  soLuongInput: number = 1;

  ngOnInit() {
    this.taiDanhSachHoaDon();
  }

  // Tải danh sách tất cả hóa đơn
  taiDanhSachHoaDon() {
    this.service.layDanhSachHoaDon().subscribe({
      next: (res: any) => {
        // Đảm bảo phải lấy qua thuộc tính .data của response từ Laravel
        const list = res.data || res;
        this.danhSachHoaDon.set(list);
      },
      error: (err) => console.error('Lỗi tải danh sách hóa đơn', err)
    });
  }

  // Tạo hóa đơn nháp mới
  taoHoaDon() {
    this.service.taoHoaDon().subscribe({
      next: (res) => {
        this.hoaDonHienTai.set(res.data);
        this.danhSachChiTiet.set([]);
        this.taiDanhSachHoaDon(); // Cập nhật lại danh sách bên dưới
        alert(res.message);
      },
      error: (err) => alert(err.error?.message || 'Lỗi tạo hóa đơn')
    });
  }

  // Tìm kiếm sản phẩm
  onSearchInput() {
    if (!this.tuKhoaTimKiem.trim()) {
      this.filteredSanPham.set([]);
      return;
    }

    this.service.timKiemSanPham(this.tuKhoaTimKiem).subscribe({
      next: (res) => this.filteredSanPham.set(res.data),
      error: (err) => console.error('Lỗi tìm kiếm sản phẩm', err)
    });
  }

  chuyenChonSanPham(sp: SanPham) {
    this.sanPhamDuocChon = sp;
    this.tuKhoaTimKiem = sp.TenSanPham;
    this.filteredSanPham.set([]);
  }

  // Thêm sản phẩm vào hóa đơn hiện tại
  themSanPham() {
    const hd = this.hoaDonHienTai();
    if (!hd) return;

    if (!this.sanPhamDuocChon || !this.sanPhamDuocChon.TenSanPham) {
      alert('Vui lòng chọn sản phẩm từ danh sách gợi ý!');
      return;
    }

    this.service.themChiTiet(hd.MaHoaDon, {
      TenSanPham: this.sanPhamDuocChon.TenSanPham,
      SoLuong: this.soLuongInput
    }).subscribe({
      next: (res) => {
        this.hoaDonHienTai.set(res.data.hoaDon);
        if (res.data.hoaDon.chi_tiet_hoa_don) {
          this.danhSachChiTiet.set(res.data.hoaDon.chi_tiet_hoa_don);
        }
        this.sanPhamDuocChon = null;
        this.tuKhoaTimKiem = '';
        this.soLuongInput = 1;
        this.taiDanhSachHoaDon(); // Cập nhật lại tổng tiền ở danh sách bên dưới
        alert(res.message);
      },
      error: (err) => alert(err.error?.message || 'Lỗi thêm sản phẩm')
    });
  }

  // Thanh toán hóa đơn
  thanhToan() {
    const hd = this.hoaDonHienTai();
    if (!hd) return;

    this.service.thanhToanHoaDon(hd.MaHoaDon).subscribe({
      next: (res) => {
        this.hoaDonHienTai.set(res.data);
        this.taiDanhSachHoaDon(); // Cập nhật trạng thái đã thanh toán xuống bảng lịch sử
        alert(res.message);
      },
      error: (err) => alert(err.error?.message || 'Lỗi khi thanh toán')
    });
  }

  // Bấm vào nút "Xem" một hóa đơn cũ trong lịch sử để load lên màn hình POS
  chonHoaDonCu(hd: HoaDon) {
    this.hoaDonHienTai.set(hd);
    if (hd.chi_tiet_hoa_don) {
      this.danhSachChiTiet.set(hd.chi_tiet_hoa_don);
    } else {
      this.danhSachChiTiet.set([]);
    }
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-lich-su-ton-kho',
  standalone: true,
  imports: [CommonModule, TableModule, CardModule, TagModule],
  template: `
    <div class="p-6">
  <h2 class="text-xl font-bold mb-4">Lịch Sử Thay Đổi & Cập Nhật Tồn Kho</h2>

  <!-- Bảng hiển thị dữ liệu -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-slate-100 border-b">
          <th class="p-3">Thời gian</th>
          <th class="p-3">Sản phẩm</th>
          <th class="p-3">Cũ</th>
          <th class="p-3">Mới</th>
          <th class="p-3">Lý do</th>
          <th class="p-3">Người thực hiện</th>
        </tr>
      </thead>
      <tbody>
        <!-- Dùng vòng lặp @for của Angular 17+ -->
        @for (item of danhSachLichSu(); track item.MaCapNhat) {
          <tr class="border-b hover:bg-slate-50">
            <td class="p-3">{{ item.ThoiGianCapNhat }}</td>
            <td class="p-3">{{ item.san_pham?.TenSanPham }}</td>
            <td class="p-3">{{ item.SoLuongHienTai }}</td>
            <td class="p-3 font-semibold text-emerald-600">{{ item.SoLuongMoi }}</td>
            <td class="p-3">{{ item.LyDoCapNhat }}</td>
            <td class="p-3">{{ item.tai_khoan?.HoTen }}</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="6" class="p-4 text-center text-slate-400">Chưa có lịch sử cập nhật tồn kho nào.</td>
          </tr>
        }
      </tbody>
    </table>
  </div>
</div>
  `
})
export class LichSuTonKhoComponent implements OnInit {
  private service = inject(ProductService);
  danhSachLichSu = signal<any[]>([]);

  ngOnInit() {
    this.taiLichSu();
  }

  taiLichSu() {
    this.service.layLichSuTonKho().subscribe({
      next: (res) => this.danhSachLichSu.set(res.data || res),
      error: (err: any) => console.error('Lỗi tải lịch sử tồn kho', err) // Thêm : any vào đây
    });
  }
}
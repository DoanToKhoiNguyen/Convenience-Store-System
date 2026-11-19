import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-lich-su-ton-kho',
  standalone: true,
  imports: [CommonModule, DatePipe, TableModule, CardModule, TagModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
            <i class="pi pi-history text-lg"></i>
          </span>
          <div>
            <h2 class="text-2xl font-semibold tracking-tight text-slate-800">Lịch Sử Thay Đổi &amp; Cập Nhật Tồn Kho</h2>
            <p class="text-sm text-slate-500">{{ danhSachLichSu().length }} lần cập nhật</p>
          </div>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          (click)="taiLichSu()"
        >
          <i class="pi pi-refresh text-xs"></i> Tải lại
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
          <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <i class="pi pi-list text-emerald-500"></i>
            Danh sách thay đổi
          </div>
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {{ danhSachLichSu().length }} bản ghi
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[52rem] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                <th class="px-4 py-3 font-semibold">Thời gian</th>
                <th class="px-4 py-3 font-semibold">Sản phẩm</th>
                <th class="px-4 py-3 text-right font-semibold">Cũ</th>
                <th class="px-4 py-3 text-right font-semibold">Mới</th>
                <th class="px-4 py-3 text-center font-semibold">Thay đổi</th>
                <th class="px-4 py-3 font-semibold">Lý do</th>
                <th class="px-4 py-3 font-semibold">Người thực hiện</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (item of danhSachLichSu(); track item.MaCapNhat) {
                <tr class="transition-colors hover:bg-emerald-100/60">
                  <td class="whitespace-nowrap px-4 py-3.5">
                    <div class="flex items-center gap-1.5 text-slate-600">
                      <i class="pi pi-clock text-xs text-slate-400"></i>
                      {{ item.ThoiGianCapNhat | date: 'dd/MM/yyyy HH:mm' }}
                    </div>
                  </td>
                  <td class="px-4 py-3.5">
                    <div class="flex items-center gap-2.5">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                        <i class="pi pi-box text-xs"></i>
                      </span>
                      <span class="font-medium text-slate-800">{{ item.san_pham?.TenSanPham ?? '—' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3.5 text-right tabular-nums text-slate-500">{{ item.SoLuongHienTai }}</td>
                  <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-emerald-600">{{ item.SoLuongMoi }}</td>
                  <td class="px-4 py-3.5 text-center">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                      [class]="(item.SoLuongMoi - item.SoLuongHienTai) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
                    >
                      {{ item.SoLuongMoi - item.SoLuongHienTai > 0 ? '+' : '' }}{{ item.SoLuongMoi - item.SoLuongHienTai }}
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-slate-600">{{ item.LyDoCapNhat }}</td>
                  <td class="px-4 py-3.5">
                    <div class="flex items-center gap-2 text-slate-700">
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <i class="pi pi-user text-[11px]"></i>
                      </span>
                      {{ item.tai_khoan?.HoTen ?? '—' }}
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-14 text-center">
                    <div class="flex flex-col items-center gap-3 text-slate-500">
                      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <i class="pi pi-inbox text-xl"></i>
                      </span>
                      <span class="text-sm">Chưa có lịch sử cập nhật tồn kho nào.</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
      next: (data) => this.danhSachLichSu.set(data),
      error: (err: any) => console.error('Lỗi tải lịch sử tồn kho', err),
    });
  }
}
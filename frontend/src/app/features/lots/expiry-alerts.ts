import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { LotAlert, RemovedLot, lotSeverity, lotText } from './lot.model';
import { LotService } from './lot.service';
import { NoticeService } from '../../core/ui/notice.service';

type Tab = 'sap_het_han' | 'da_loai';

@Component({
  selector: 'app-expiry-alerts',
  imports: [RouterLink, DatePipe, ButtonModule, TagModule],
  template: `
    <div class="mb-4 flex gap-2 border-b border-slate-200">
      <a routerLink="/admin/stock-alerts" class="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-emerald-700">
        Sắp hết hàng
      </a>
      <span class="-mb-px border-b-2 border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700">Sắp hết hạn</span>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Cảnh báo hạn sử dụng</h1>
        <p class="text-sm text-slate-500">Lô còn hàng sắp hết hạn; lô quá hạn được hệ thống tự động loại khỏi tồn kho</p>
      </div>
      <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading() || loadingRemoved()" (onClick)="load()" />
    </div>

    <div class="mb-4 grid gap-3 sm:grid-cols-2">
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <i class="pi pi-clock"></i>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Lô sắp hết hạn</div>
          <div class="text-2xl font-semibold tabular-nums text-amber-600">{{ soon() }}</div>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <i class="pi pi-inbox"></i>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Đã tự động loại</div>
          <div class="text-2xl font-semibold tabular-nums text-slate-700">{{ removedCount() }}</div>
        </div>
      </div>
    </div>

    <div class="mb-4 inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white p-1 shadow-sm">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        [class]="tab() === 'sap_het_han' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-700'"
        (click)="chonTab('sap_het_han')"
      >
        <i class="pi pi-clock text-xs"></i>
        Sắp hết hạn
        @if (notice.moiHan() ? soon() : 0; as n) {
          <span
            class="inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-semibold leading-none"
            [class]="tab() === 'sap_het_han' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'"
          >
            <i class="pi pi-bell text-[9px]"></i>
            {{ n }}
          </span>
        }
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        [class]="tab() === 'da_loai' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-700'"
        (click)="chonTab('da_loai')"
      >
        <i class="pi pi-inbox text-xs"></i>
        Đã loại
        @if (notice.moiDaLoai() ? removedCount() : 0; as n) {
          <span
            class="inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-semibold leading-none"
            [class]="tab() === 'da_loai' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'"
          >
            <i class="pi pi-bell text-[9px]"></i>
            {{ n }}
          </span>
        }
      </button>
    </div>

    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    @if (tab() === 'sap_het_han') {
      <div class="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table class="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <th class="px-4 py-3 font-semibold">Sản phẩm</th>
              <th class="px-4 py-3 font-semibold">Mã lô</th>
              <th class="px-4 py-3 font-semibold">Hạn sử dụng</th>
              <th class="px-4 py-3 text-right font-semibold">Còn lại</th>
              <th class="px-4 py-3 font-semibold">Tình trạng</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (l of items(); track l.MaLoHang) {
              <tr class="transition-colors hover:bg-emerald-100/60">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-800">{{ l.TenSanPham }}</div>
                  @if (l.LoaiSanPham) {
                    <div class="text-xs text-slate-500">{{ l.LoaiSanPham }}</div>
                  }
                </td>
                <td class="px-4 py-3 font-medium text-slate-700">{{ l.MaLo }}</td>
                <td class="px-4 py-3 text-slate-600">{{ l.HanSuDung | date: 'dd/MM/yyyy' }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ l.SoLuongCon }}</td>
                <td class="px-4 py-3">
                  <p-tag [value]="text(l)" [severity]="severity(l.trang_thai)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-12 text-center">
                  @if (loading()) {
                    <span class="inline-flex items-center gap-2 text-slate-400">
                      <i class="pi pi-spin pi-spinner text-emerald-500"></i> Đang tải...
                    </span>
                  } @else {
                    <span class="text-slate-500">Không có lô hàng nào sắp hết hạn.</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table class="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <th class="px-4 py-3 font-semibold">Sản phẩm</th>
              <th class="px-4 py-3 font-semibold">Mã lô</th>
              <th class="px-4 py-3 font-semibold">Hạn sử dụng</th>
              <th class="px-4 py-3 text-right font-semibold">Số lượng đã loại</th>
              <th class="px-4 py-3 font-semibold">Thời gian loại</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (r of removed(); track r.MaLoai) {
              <tr class="transition-colors hover:bg-emerald-100/60">
                <td class="px-4 py-3 font-medium text-slate-800">{{ r.TenSanPham }}</td>
                <td class="px-4 py-3 font-medium text-slate-700">{{ r.MaLo }}</td>
                <td class="px-4 py-3 text-slate-600">{{ r.HanSuDung | date: 'dd/MM/yyyy' }}</td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{{ r.SoLuongLoai }}</td>
                <td class="px-4 py-3">
                  <div class="text-slate-600">{{ r.ThoiGianLoai | date: 'dd/MM/yyyy HH:mm' }}</div>
                  <div class="text-xs text-slate-500">{{ r.NguoiThucHien }}</div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-12 text-center">
                  @if (loadingRemoved()) {
                    <span class="inline-flex items-center gap-2 text-slate-400">
                      <i class="pi pi-spin pi-spinner text-emerald-500"></i> Đang tải...
                    </span>
                  } @else {
                    <span class="text-slate-500">Chưa có lô hàng nào bị loại.</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <p class="mt-3 text-xs text-slate-500">
      Mức cảnh báo lấy từ cột "Cảnh báo HSD (ngày)" của từng sản phẩm. Lô quá hạn được hệ thống tự động trừ khỏi tồn kho
      (khi mở trang này hoặc theo lịch mỗi phút) và ghi vào tab "Đã loại"; không cần thao tác tay và không thể hoàn lại.
    </p>
  `,
})
export class ExpiryAlerts {
  private service = inject(LotService);
  readonly notice = inject(NoticeService);

  readonly tab = signal<Tab>('sap_het_han');
  readonly items = signal<LotAlert[]>([]);
  readonly removed = signal<RemovedLot[]>([]);
  readonly loading = signal(true);
  readonly loadingRemoved = signal(true);
  readonly error = signal<string | null>(null);

  readonly text = lotText;
  readonly severity = lotSeverity;

  readonly soon = computed(() => this.items().length);
  readonly removedCount = computed(() => this.removed().length);

  constructor() {
    this.load();
  }

  chonTab(t: Tab) {
    this.tab.set(t);
    // Mở tab "Đã loại" là coi như đã xem: badge giữ số, ẩn chuông
    if (t === 'da_loai') {
      this.notice.xemKenh('daLoai');
      this.notice.refresh();
    }
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.service.alerts().subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
        // Xem cảnh báo xong hệ thống đã tự loại lô quá hạn, tải tiếp nhật ký để thấy ngay
        this.loadRemoved();
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được cảnh báo hạn sử dụng.');
        this.loadRemoved();
      },
    });
  }

  private loadRemoved() {
    this.loadingRemoved.set(true);

    this.service.removed().subscribe({
      next: (data) => {
        this.removed.set(data);
        this.loadingRemoved.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loadingRemoved.set(false);
        this.error.set(e.error?.message ?? 'Không tải được danh sách lô đã loại.');
      },
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { LotAlert, lotSeverity, lotText } from './lot.model';
import { LotService } from './lot.service';

type Filter = 'all' | 'het_han' | 'sap_het_han';

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
        <p class="text-sm text-slate-500">Các lô hàng đã hết hạn hoặc còn ít ngày hơn mức cảnh báo của sản phẩm</p>
      </div>
      <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
    </div>

    <div class="mb-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Lô đã hết hạn</div>
        <div class="text-2xl font-semibold text-red-600">{{ expired() }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Lô sắp hết hạn</div>
        <div class="text-2xl font-semibold text-amber-600">{{ soon() }}</div>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium"
          [class]="filter() === t.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          (click)="filter.set(t.key)"
        >
          {{ t.label }}
        </button>
      }
    </div>

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    <div class="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[48rem] text-left text-sm">
        <thead>
          <tr class="border-b bg-slate-50 text-slate-600">
            <th class="p-3">Sản phẩm</th>
            <th class="p-3">Mã lô</th>
            <th class="p-3">Hạn sử dụng</th>
            <th class="p-3 text-right">Còn lại</th>
            <th class="p-3">Tình trạng</th>
            <th class="p-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (l of shown(); track l.MaLoHang) {
            <tr class="border-b border-slate-100 hover:bg-slate-50" [class.bg-red-50]="l.trang_thai === 'het_han'">
              <td class="p-3">
                <div class="font-medium text-slate-800">{{ l.TenSanPham }}</div>
                @if (l.LoaiSanPham) {
                  <div class="text-xs text-slate-500">{{ l.LoaiSanPham }}</div>
                }
              </td>
              <td class="p-3 font-medium">{{ l.MaLo }}</td>
              <td class="p-3">{{ l.HanSuDung | date: 'dd/MM/yyyy' }}</td>
              <td class="p-3 text-right">{{ l.SoLuongCon }}</td>
              <td class="p-3">
                <p-tag [value]="text(l)" [severity]="severity(l.trang_thai)" />
              </td>
              <td class="p-3 text-right">
                <p-button label="Hủy lô" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="cancel(l)" />
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="p-8 text-center text-slate-500">
                {{ loading() ? 'Đang tải...' : 'Không có lô hàng nào sắp hết hạn.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      Mức cảnh báo lấy từ cột "Cảnh báo HSD (ngày)" của từng sản phẩm. Lô đã hết hạn không bán được ở trang Bán hàng.
      Bấm "Hủy lô" để trừ phần hàng còn lại khỏi tồn kho (có ghi vào lịch sử).
    </p>
  `,
})
export class ExpiryAlerts {
    private service = inject(LotService);

    readonly tabs: { key: Filter; label: string }[] = [
        { key: 'all', label: 'Tất cả' },
        { key: 'het_han', label: 'Đã hết hạn' },
        { key: 'sap_het_han', label: 'Sắp hết hạn' },
    ];

    readonly text = lotText;
    readonly severity = lotSeverity;

    readonly items = signal<LotAlert[]>([]);
    readonly filter = signal<Filter>('all');
    readonly loading = signal(true);
    readonly busy = signal(false);
    readonly error = signal<string | null>(null);
    readonly success = signal<string | null>(null);

    readonly expired = computed(() => this.items().filter((l) => l.trang_thai === 'het_han').length);
    readonly soon = computed(() => this.items().filter((l) => l.trang_thai === 'sap_het_han').length);
    readonly shown = computed(() =>
        this.filter() === 'all' ? this.items() : this.items().filter((l) => l.trang_thai === this.filter()),
    );

    constructor() {
        this.load();
    }

    load() {
        this.loading.set(true);
        this.service.alerts().subscribe({
            next: (data) => {
                this.items.set(data);
                this.loading.set(false);
            },
            error: (e: HttpErrorResponse) => {
                this.loading.set(false);
                this.error.set(e.error?.message ?? 'Không tải được cảnh báo hạn sử dụng.');
            },
        });
    }

    cancel(l: LotAlert) {
        const reason = prompt(
            `Hủy lô ${l.MaLo} (${l.TenSanPham})?\n${l.SoLuongCon} sản phẩm còn lại sẽ bị trừ khỏi tồn kho.\nLý do:`,
            l.trang_thai === 'het_han' ? 'Hàng hết hạn' : 'Hủy lô',
        );
        if (reason === null) return;

        this.busy.set(true);
        this.error.set(null);
        this.service.cancel(l.MaLoHang, reason.trim() || 'Hàng hết hạn').subscribe({
            next: (res) => {
                this.busy.set(false);
                this.success.set(res.message);
                setTimeout(() => this.success.set(null), 4000);
                this.load();
            },
            error: (e: HttpErrorResponse) => {
                this.busy.set(false);
                this.error.set(e.error?.message ?? 'Hủy lô thất bại.');
                this.load();
            },
        });
    }
}
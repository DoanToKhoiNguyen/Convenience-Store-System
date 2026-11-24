import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { addDays, displayDate, formatDate, parseDate } from '../shifts/week.util';
import { Group, ImportReport, RevenueReport } from './report.model';
import { ReportService } from './report.service';

type View = 'doanh_thu' | 'nhap_hang';
type Mode = 'ngay' | 'thang' | 'nam' | 'tuy_chon';
type ProductTab = 'ban_chay' | 'sinh_loi' | 'ban_cham';
type ImportTab = 'nha_cung_cap' | 'san_pham' | 'phieu_nhap';

interface Change {
  text: string;
  up: boolean;
}

interface ChartPoint {
  label: string;
  value: number;
  tip: string;
  line?: number; // đường lợi nhuận (nếu có)
  lineTip?: string;
}

const money = (v: number) => Math.round(v).toLocaleString('vi-VN');

const compact = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e9) return sign + (a / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ';
  if (a >= 1e6) return sign + (a / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  if (a >= 1e3) return sign + Math.round(a / 1e3).toLocaleString('vi-VN') + 'k';
  return sign + Math.round(a);
};

// Làm tròn lên một số "đẹp" (1, 2, 5, 10 × 10^n) để trục biểu đồ gọn
const niceCeil = (v: number): number => {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

// Tính toạ độ biểu đồ cột (và đường lợi nhuận nếu có) cho cả hai tab
function buildChart(points: ChartPoint[], showLine: boolean) {
  const W = 800, H = 300, L = 62, R = 12, T = 12, B = 34;
  const iw = W - L - R;
  const ih = H - T - B;

  const values = points.flatMap((p) => (showLine ? [p.value, p.line ?? 0] : [p.value]));
  const yMax = niceCeil(Math.max(0, ...values));
  const rawMin = Math.min(0, ...values);
  const yMin = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const span = yMax - yMin || 1;

  const y = (v: number) => T + (ih * (yMax - v)) / span;
  const n = Math.max(points.length, 1);
  const slot = iw / n;
  const bw = Math.min(slot * 0.65, 36);
  const x = (i: number) => L + slot * (i + 0.5);
  const zeroY = y(0);

  const bars = points.map((p, i) => {
    const top = y(p.value);
    return {
      x: x(i) - bw / 2,
      y: top,
      w: bw,
      h: Math.max(zeroY - top, p.value > 0 ? 1 : 0),
      tip: p.tip,
    };
  });

  const dots = showLine
    ? points.map((p, i) => ({ x: x(i), y: y(p.line ?? 0), tip: p.lineTip ?? '' }))
    : [];

  const ticks = [0, 1, 2, 3, 4].map((k) => {
    const v = yMin + (span * k) / 4;
    return { y: y(v), label: compact(v) };
  });

  const step = Math.max(1, Math.ceil(n / 12));
  const xlabels = points
    .map((p, i) => ({ x: x(i), text: p.label, show: i % step === 0 }))
    .filter((l) => l.show);

  return { W, H, L, R, zeroY, bars, dots, line: dots.map((p) => `${p.x},${p.y}`).join(' '), ticks, xlabels };
}

@Component({
  selector: 'app-revenue-report',
  imports: [DatePipe, NgTemplateOutlet],
  template: `
    <!-- Tiêu đề và chọn thời gian -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">
          {{ view() === 'doanh_thu' ? 'Báo cáo doanh thu' : 'Báo cáo nhập hàng' }}
        </h1>
        <p class="text-sm text-slate-500">{{ title() }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-xl bg-slate-200/70 p-1">
          @for (m of modes; track m.key) {
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              [class]="mode() === m.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
              (click)="setMode(m.key)"
            >
              {{ m.label }}
            </button>
          }
        </div>

        @if (mode() !== 'tuy_chon') {
          <div class="inline-flex items-center rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              class="px-3 py-2 text-slate-500 hover:text-emerald-700"
              aria-label="Kỳ trước"
              (click)="shift(-1)"
            >
              <i class="pi pi-angle-left"></i>
            </button>

            @switch (mode()) {
              @case ('ngay') {
                <input
                  type="date"
                  class="w-36 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
                  [value]="day()"
                  [max]="today"
                  (change)="onDay($any($event.target).value)"
                />
              }
              @case ('thang') {
                <input
                  type="month"
                  class="w-40 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
                  [value]="month()"
                  [max]="today.slice(0, 7)"
                  (change)="onMonth($any($event.target).value)"
                />
              }
              @default {
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  class="w-20 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
                  [value]="year()"
                  (change)="onYear($any($event.target).value)"
                />
              }
            }

            <button
              type="button"
              class="px-3 py-2 text-slate-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-500"
              aria-label="Kỳ sau"
              [disabled]="!canNext()"
              (click)="shift(1)"
            >
              <i class="pi pi-angle-right"></i>
            </button>
          </div>
        } @else {
          <div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1">
            <input type="date" class="border-0 bg-transparent py-1.5 text-sm focus:outline-none" [value]="from()" [max]="today" (change)="from.set($any($event.target).value)" />
            <i class="pi pi-arrow-right text-xs text-slate-400"></i>
            <input type="date" class="border-0 bg-transparent py-1.5 text-sm focus:outline-none" [value]="to()" [max]="today" (change)="to.set($any($event.target).value)" />
            <button
              type="button"
              class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              (click)="load()"
            >
              Xem
            </button>
          </div>
        }

        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-600 hover:text-emerald-700 disabled:opacity-60"
          title="Tải lại"
          aria-label="Tải lại"
          [disabled]="loading()"
          (click)="load()"
        >
          <i [class]="loading() ? 'pi pi-refresh animate-spin' : 'pi pi-refresh'"></i>
        </button>
      </div>
    </div>

    <!-- Chuyển giữa các báo cáo (chỉ chủ thấy tab Nhập hàng) -->
    @if (canImport()) {
      <div class="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        @for (v of views; track v.key) {
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
            [class]="view() === v.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
            (click)="setView(v.key)"
          >
            <i [class]="v.icon"></i>{{ v.label }}
          </button>
        }
      </div>
    }

    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    @if (view() === 'doanh_thu') {
      <!-- ================= DOANH THU VÀ LỢI NHUẬN ================= -->
      @if (data(); as d) {
        <div [class]="loading() ? 'opacity-60 transition' : 'transition'">
          <!-- Hai con số chính -->
          <div [class]="d.quyen.xem_loi_nhuan ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'">
            <section class="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-sm">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-emerald-50">Doanh thu</span>
                <i class="pi pi-wallet text-emerald-100"></i>
              </div>
              <div class="mt-2 break-words text-3xl font-bold sm:text-4xl">{{ money(d.tong_hop.doanh_thu) }} ₫</div>

              @if (changes()?.rev; as c) {
                <span
                  class="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                  [class]="c.up ? 'bg-white/20 text-white' : 'bg-red-900/40 text-red-100'"
                >
                  {{ c.text }}
                </span>
              }
              <p class="mt-3 text-sm text-emerald-50">
                Tiền thực thu từ {{ d.tong_hop.so_hoa_don }} hóa đơn đã thanh toán
              </p>
            </section>

            @if (d.quyen.xem_loi_nhuan) {
              <section class="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-300">Lợi nhuận gộp</span>
                  <i class="pi pi-chart-line text-slate-400"></i>
                </div>
                <div
                  class="mt-2 break-words text-3xl font-bold sm:text-4xl"
                  [class]="(d.tong_hop.loi_nhuan ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'"
                >
                  {{ money(d.tong_hop.loi_nhuan ?? 0) }} ₫
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  @if (changes()?.profit; as c) {
                    <span
                      class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                      [class]="c.up ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'"
                    >
                      {{ c.text }}
                    </span>
                  }
                  <span class="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                    Biên lợi nhuận {{ (d.tong_hop.bien_loi_nhuan ?? 0).toLocaleString('vi-VN') }}%
                  </span>
                </div>

                @if (split(); as s) {
                  <div class="mt-4">
                    <div class="flex h-3 overflow-hidden rounded-full bg-white/10">
                      <div class="h-full bg-slate-400" [style.width.%]="s.costPct"></div>
                      <div class="h-full bg-emerald-400" [style.width.%]="s.profitPct"></div>
                    </div>
                    <div class="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-300">
                      <span class="flex items-center gap-1.5">
                        <span class="inline-block h-2 w-2 rounded-full bg-slate-400"></span>
                        Giá vốn {{ money(s.cost) }} ₫ ({{ s.costPct.toLocaleString('vi-VN') }}%)
                      </span>
                      <span class="flex items-center gap-1.5">
                        <span class="inline-block h-2 w-2 rounded-full" [class]="s.loss ? 'bg-red-400' : 'bg-emerald-400'"></span>
                        {{ s.loss ? 'Đang lỗ' : 'Lợi nhuận ' + s.profitPct.toLocaleString('vi-VN') + '%' }}
                      </span>
                    </div>
                  </div>
                }
              </section>
            }
          </div>

          <!-- Chỉ số phụ -->
          <div class="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
            <div>
              <div class="text-xs text-slate-500">Số hóa đơn</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ d.tong_hop.so_hoa_don.toLocaleString('vi-VN') }}</div>
              @if (changes()?.inv; as c) {
                <div class="text-xs" [class]="c.up ? 'text-emerald-600' : 'text-red-600'">{{ c.text }}</div>
              }
            </div>
            <div>
              <div class="text-xs text-slate-500">Trung bình mỗi hóa đơn</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ money(d.tong_hop.trung_binh) }} ₫</div>
              @if (changes()?.avg; as c) {
                <div class="text-xs" [class]="c.up ? 'text-emerald-600' : 'text-red-600'">{{ c.text }}</div>
              }
            </div>
            <div class="col-span-2 sm:col-span-1">
              <div class="text-xs text-slate-500">Giảm giá đã cho khách</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ money(d.tong_hop.giam_gia) }} ₫</div>
              <div class="text-xs text-slate-500">Chi phí khuyến mãi trong kỳ</div>
            </div>
          </div>

          @if (d.dang_cho.so_hoa_don > 0) {
            <div class="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <i class="pi pi-clock mt-0.5"></i>
              <span>
                Đang có <b>{{ d.dang_cho.so_hoa_don }}</b> hóa đơn chờ thanh toán, tổng
                <b>{{ money(d.dang_cho.tong_tien) }} ₫</b>. Chưa tính vào doanh thu.
              </span>
            </div>
          }

          <!-- Biểu đồ -->
          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold text-slate-800">{{ chartTitle() }}</h2>
              <div class="flex items-center gap-4 text-xs text-slate-600">
                <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-emerald-500"></span>Doanh thu</span>
                @if (d.quyen.xem_loi_nhuan) {
                  <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></span>Lợi nhuận gộp</span>
                }
              </div>
            </div>

            @if (d.tong_hop.so_hoa_don === 0) {
              <div class="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
                <i class="pi pi-chart-bar text-4xl"></i>
                <p class="text-sm">Chưa có hóa đơn nào được thanh toán trong khoảng thời gian này.</p>
              </div>
            } @else {
              <ng-container
                [ngTemplateOutlet]="chartTpl"
                [ngTemplateOutletContext]="{ $implicit: chart(), color: '#10b981' }"
              ></ng-container>
            }
          </section>

          <!-- Thanh toán -->
          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <h2 class="mb-4 font-semibold text-slate-800">Thanh toán bằng gì</h2>
            @for (m of d.phuong_thuc; track m.ten) {
              <div class="mb-4 last:mb-0">
                <div class="mb-1.5 flex items-baseline justify-between text-sm">
                  <span class="font-medium text-slate-700">
                    {{ m.ten }} <span class="font-normal text-slate-400">· {{ m.so_hoa_don }} hóa đơn</span>
                  </span>
                  <span class="text-slate-800">{{ money(m.doanh_thu) }} ₫ <span class="text-slate-400">({{ percent(m.doanh_thu) }}%)</span></span>
                </div>
                <div class="h-2 rounded-full bg-slate-100">
                  <div class="h-2 rounded-full bg-emerald-500" [style.width.%]="percent(m.doanh_thu)"></div>
                </div>
              </div>
            } @empty {
              <p class="text-sm text-slate-400">Chưa có dữ liệu.</p>
            }
          </section>

          <!-- Sản phẩm -->
          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div class="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
              @for (t of productTabs(); track t.key) {
                <button
                  type="button"
                  class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
                  [class]="productTab() === t.key
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'"
                  (click)="productTab.set(t.key)"
                >
                  {{ t.label }}
                </button>
              }
            </div>

            <div class="overflow-x-auto">
              @if (productTab() === 'ban_chay') {
                <table class="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr class="border-b text-left text-slate-500">
                      <th class="w-10 py-2">#</th>
                      <th>Sản phẩm</th>
                      <th class="text-right">Đã bán</th>
                      <th class="text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of d.ban_chay; track p.MaSanPham; let i = $index) {
                      <tr class="border-b border-slate-100">
                        <td class="py-2.5 text-slate-400">{{ i + 1 }}</td>
                        <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                        <td class="text-right">{{ p.so_luong }}</td>
                        <td class="text-right">{{ money(p.doanh_thu) }} ₫</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="py-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr>
                    }
                  </tbody>
                </table>
              }

              @if (productTab() === 'sinh_loi' && d.quyen.xem_loi_nhuan) {
                <table class="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr class="border-b text-left text-slate-500">
                      <th class="w-10 py-2">#</th>
                      <th>Sản phẩm</th>
                      <th class="text-right">Đã bán</th>
                      <th class="text-right">Lợi nhuận</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of d.sinh_loi ?? []; track p.MaSanPham; let i = $index) {
                      <tr class="border-b border-slate-100">
                        <td class="py-2.5 text-slate-400">{{ i + 1 }}</td>
                        <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                        <td class="text-right">{{ p.so_luong }}</td>
                        <td class="text-right font-medium" [class]="(p.loi_nhuan ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'">
                          {{ money(p.loi_nhuan ?? 0) }} ₫
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="py-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr>
                    }
                  </tbody>
                </table>
                <p class="mt-2 text-xs text-slate-400">Lợi nhuận theo từng sản phẩm tính trước khi trừ giảm giá.</p>
              }

              @if (productTab() === 'ban_cham') {
                <p class="mb-2 text-xs text-slate-500">
                  Sản phẩm còn hàng trong kho nhưng bán được ít nhất trong kỳ (kể cả chưa bán được cái nào).
                </p>
                <table class="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr class="border-b text-left text-slate-500">
                      <th class="w-10 py-2">#</th>
                      <th>Sản phẩm</th>
                      <th class="text-right">Đã bán</th>
                      <th class="text-right">Tồn kho</th>
                      @if (d.quyen.xem_loi_nhuan) {
                        <th class="text-right">Vốn nằm trong kho</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of d.ban_cham; track p.MaSanPham; let i = $index) {
                      <tr class="border-b border-slate-100">
                        <td class="py-2.5 text-slate-400">{{ i + 1 }}</td>
                        <td>
                          <div class="font-medium text-slate-800">{{ p.TenSanPham }}</div>
                          @if (p.LoaiSanPham) {
                            <div class="text-xs text-slate-400">{{ p.LoaiSanPham }}</div>
                          }
                        </td>
                        <td class="text-right" [class]="p.so_luong === 0 ? 'font-medium text-red-600' : ''">
                          {{ p.so_luong === 0 ? 'Chưa bán được' : p.so_luong }}
                        </td>
                        <td class="text-right">{{ p.SoLuongHienTai }}</td>
                        @if (d.quyen.xem_loi_nhuan) {
                          <td class="text-right">{{ money(p.von_ton ?? 0) }} ₫</td>
                        }
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="py-6 text-center text-slate-400">Không có sản phẩm nào.</td></tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </section>

          <details class="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
            <summary class="cursor-pointer font-medium text-slate-700">Cách tính các con số</summary>
            <div class="mt-3 space-y-2 text-xs leading-5 text-slate-500">
              <p>
                <b>Doanh thu</b> là số tiền thực thu (đã trừ giảm giá) của các hóa đơn đã thanh toán, tính theo ngày thanh toán.
                Hóa đơn chờ thanh toán và hóa đơn đã hủy không được tính.
              </p>
              @if (d.quyen.xem_loi_nhuan) {
                <p>
                  <b>Lợi nhuận gộp</b> = doanh thu − giá vốn hàng bán (giá nhập tại lúc bán). Chưa trừ lương, mặt bằng, điện nước,
                  hàng hủy hoặc hết hạn.
                </p>
              }
              <p>
                <b>Kỳ trước</b> là khoảng thời gian liền kề phía trước có cùng số ngày
                ({{ displayDate(d.ky_truoc.tu_ngay) }} – {{ displayDate(d.ky_truoc.den_ngay) }}).
              </p>
            </div>
          </details>
        </div>
      } @else if (loading()) {
        <div class="grid gap-4 md:grid-cols-2">
          <div class="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
          <div class="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
        </div>
      }
    } @else {
      <!-- ================= NHẬP HÀNG (chỉ chủ) ================= -->
      @if (imp(); as m) {
        <div [class]="loading() ? 'opacity-60 transition' : 'transition'">
          <section class="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-amber-50">Tiền nhập hàng</span>
              <i class="pi pi-truck text-amber-100"></i>
            </div>
            <div class="mt-2 break-words text-3xl font-bold sm:text-4xl">{{ money(m.tong_hop.gia_tri) }} ₫</div>

            @if (impChanges()?.value; as c) {
              <span class="mt-3 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                {{ c.text }}
              </span>
            }
            <p class="mt-3 text-sm text-amber-50">
              Giá trị hàng đã nhận từ {{ m.tong_hop.so_phieu }} phiếu nhập trong kỳ
            </p>
          </section>

          <div class="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-4">
            <div>
              <div class="text-xs text-slate-500">Số phiếu nhập</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ m.tong_hop.so_phieu.toLocaleString('vi-VN') }}</div>
              @if (impChanges()?.phieu; as c) {
                <div class="text-xs text-slate-500">{{ c.text }}</div>
              }
            </div>
            <div>
              <div class="text-xs text-slate-500">Tổng số lượng nhập</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ m.tong_hop.so_luong.toLocaleString('vi-VN') }}</div>
            </div>
            <div>
              <div class="text-xs text-slate-500">Trung bình mỗi phiếu</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ money(m.tong_hop.trung_binh) }} ₫</div>
            </div>
            <div>
              <div class="text-xs text-slate-500">Loại sản phẩm đã nhập</div>
              <div class="mt-0.5 text-xl font-semibold text-slate-800">{{ m.tong_hop.so_san_pham.toLocaleString('vi-VN') }}</div>
            </div>
          </div>

          @if (m.dang_cho.so_phieu > 0) {
            <div class="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <i class="pi pi-clock mt-0.5"></i>
              <span>
                Đang có <b>{{ m.dang_cho.so_phieu }}</b> phiếu nhập chưa nhận hàng (chờ duyệt hoặc đã duyệt), tổng
                <b>{{ money(m.dang_cho.gia_tri) }} ₫</b>. Chưa tính vào tiền nhập hàng.
              </span>
            </div>
          }

          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold text-slate-800">{{ impChartTitle() }}</h2>
              <span class="flex items-center gap-1.5 text-xs text-slate-600">
                <span class="inline-block h-3 w-3 rounded-sm bg-amber-500"></span>Tiền nhập hàng
              </span>
            </div>

            @if (m.tong_hop.so_phieu === 0) {
              <div class="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
                <i class="pi pi-truck text-4xl"></i>
                <p class="text-sm">Chưa nhận hàng nào trong khoảng thời gian này.</p>
              </div>
            } @else {
              <ng-container
                [ngTemplateOutlet]="chartTpl"
                [ngTemplateOutletContext]="{ $implicit: impChart(), color: '#f59e0b' }"
              ></ng-container>
            }
          </section>

          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div class="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
              @for (t of importTabs; track t.key) {
                <button
                  type="button"
                  class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
                  [class]="impTab() === t.key
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'"
                  (click)="impTab.set(t.key)"
                >
                  {{ t.label }}
                </button>
              }
            </div>

            <div class="overflow-x-auto">
              @if (impTab() === 'nha_cung_cap') {
                @for (s of m.nha_cung_cap; track s.MaNhaCungCap) {
                  <div class="mb-4 last:mb-0">
                    <div class="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span class="font-medium text-slate-700">
                        {{ s.TenNhaCungCap }} <span class="font-normal text-slate-400">· {{ s.so_phieu }} phiếu</span>
                      </span>
                      <span class="shrink-0 text-slate-800">
                        {{ money(s.gia_tri) }} ₫ <span class="text-slate-400">({{ impPercent(s.gia_tri) }}%)</span>
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-100">
                      <div class="h-2 rounded-full bg-amber-500" [style.width.%]="impPercent(s.gia_tri)"></div>
                    </div>
                  </div>
                } @empty {
                  <p class="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
                }
              }

              @if (impTab() === 'san_pham') {
                <table class="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr class="border-b text-left text-slate-500">
                      <th class="w-10 py-2">#</th>
                      <th>Sản phẩm</th>
                      <th class="text-right">Đã nhập</th>
                      <th class="text-right">Giá nhập trung bình</th>
                      <th class="text-right">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of m.san_pham; track p.MaSanPham; let i = $index) {
                      <tr class="border-b border-slate-100">
                        <td class="py-2.5 text-slate-400">{{ i + 1 }}</td>
                        <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                        <td class="text-right">{{ p.so_luong.toLocaleString('vi-VN') }}</td>
                        <td class="text-right">
                          {{ money(p.gia_trung_binh) }} ₫
                          @if (p.gia_thap !== p.gia_cao) {
                            <div class="text-xs text-amber-600">Giá đổi: {{ money(p.gia_thap) }} – {{ money(p.gia_cao) }}</div>
                          }
                        </td>
                        <td class="text-right font-medium">{{ money(p.gia_tri) }} ₫</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="py-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr>
                    }
                  </tbody>
                </table>
              }

              @if (impTab() === 'phieu_nhap') {
                <table class="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr class="border-b text-left text-slate-500">
                      <th class="py-2">Mã phiếu</th>
                      <th>Ngày nhận</th>
                      <th>Nhà cung cấp</th>
                      <th class="text-right">Số lượng</th>
                      <th class="text-right">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of m.phieu_nhap; track r.MaPhieuNhap) {
                      <tr class="border-b border-slate-100">
                        <td class="py-2.5 font-medium text-slate-800">{{ r.MaPhieuNhap }}</td>
                        <td>{{ r.ngay_nhan | date: 'dd/MM/yyyy HH:mm' }}</td>
                        <td>{{ r.TenNhaCungCap ?? '—' }}</td>
                        <td class="text-right">{{ r.so_luong.toLocaleString('vi-VN') }}</td>
                        <td class="text-right font-medium">{{ money(r.gia_tri) }} ₫</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="py-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr>
                    }
                  </tbody>
                </table>
                @if (m.tong_hop.so_phieu > m.phieu_nhap.length) {
                  <p class="mt-2 text-xs text-slate-400">Hiển thị {{ m.phieu_nhap.length }} phiếu gần nhất.</p>
                }
              }
            </div>
          </section>

          <details class="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
            <summary class="cursor-pointer font-medium text-slate-700">Cách tính các con số</summary>
            <div class="mt-3 space-y-2 text-xs leading-5 text-slate-500">
              <p>
                <b>Tiền nhập hàng</b> là tổng (số lượng × đơn giá nhập) của các phiếu nhập <b>đã nhận hàng</b>, tính theo ngày nhận hàng.
                Phiếu chờ duyệt, phiếu đã duyệt nhưng chưa nhận và phiếu đã hủy không được tính.
              </p>
              <p>Đơn giá nhập là giá ghi trên phiếu lúc lập, nên đổi giá nhập của sản phẩm sau đó không làm thay đổi các phiếu cũ.</p>
              <p>
                <b>Kỳ trước</b> là khoảng thời gian liền kề phía trước có cùng số ngày
                ({{ displayDate(m.ky_truoc.tu_ngay) }} – {{ displayDate(m.ky_truoc.den_ngay) }}).
              </p>
            </div>
          </details>
        </div>
      } @else if (loading()) {
        <div class="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
      }
    }

    <!-- Biểu đồ cột dùng chung cho cả hai báo cáo -->
    <ng-template #chartTpl let-c let-color="color">
      <svg [attr.viewBox]="'0 0 ' + c.W + ' ' + c.H" class="h-auto w-full" role="img" aria-label="Biểu đồ">
        @for (t of c.ticks; track $index) {
          <line [attr.x1]="c.L" [attr.x2]="c.W - c.R" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 4" />
          <text [attr.x]="c.L - 8" [attr.y]="t.y + 4" text-anchor="end" font-size="11" fill="#94a3b8">{{ t.label }}</text>
        }
        <line [attr.x1]="c.L" [attr.x2]="c.W - c.R" [attr.y1]="c.zeroY" [attr.y2]="c.zeroY" stroke="#cbd5e1" stroke-width="1" />

        @for (b of c.bars; track $index) {
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4" [attr.fill]="color" class="hover:opacity-80">
            <title>{{ b.tip }}</title>
          </rect>
        }

        @if (c.line) {
          <polyline [attr.points]="c.line" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round" />
        }
        @for (p of c.dots; track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" fill="#fff" stroke="#f59e0b" stroke-width="2">
            <title>{{ p.tip }}</title>
          </circle>
        }

        @for (l of c.xlabels; track $index) {
          <text [attr.x]="l.x" [attr.y]="c.H - 10" text-anchor="middle" font-size="11" fill="#94a3b8">{{ l.text }}</text>
        }
      </svg>
    </ng-template>
  `,
})
export class RevenueReport_ {
  private service = inject(ReportService);
  private auth = inject(AuthService);

  readonly money = money;
  readonly displayDate = displayDate;
  readonly today = formatDate(new Date());

  // Chỉ chủ doanh nghiệp xem được báo cáo nhập hàng (giá vốn)
  readonly canImport = computed(() => this.auth.hasAnyRole([ROLE.OWNER]));

  readonly views: { key: View; label: string; icon: string }[] = [
    { key: 'doanh_thu', label: 'Doanh thu & lợi nhuận', icon: 'pi pi-chart-line' },
    { key: 'nhap_hang', label: 'Nhập hàng', icon: 'pi pi-truck' },
  ];

  readonly importTabs: { key: ImportTab; label: string }[] = [
    { key: 'nha_cung_cap', label: 'Theo nhà cung cấp' },
    { key: 'san_pham', label: 'Theo sản phẩm' },
    { key: 'phieu_nhap', label: 'Phiếu nhập' },
  ];

  readonly modes: { key: Mode; label: string }[] = [
    { key: 'ngay', label: 'Ngày' },
    { key: 'thang', label: 'Tháng' },
    { key: 'nam', label: 'Năm' },
    { key: 'tuy_chon', label: 'Tùy chọn' },
  ];

  readonly view = signal<View>('doanh_thu');
  readonly mode = signal<Mode>('thang');
  readonly day = signal(this.today);
  readonly month = signal(this.today.slice(0, 7));
  readonly year = signal(new Date().getFullYear());
  readonly from = signal(addDays(this.today, -6));
  readonly to = signal(this.today);

  readonly data = signal<RevenueReport | null>(null);
  readonly imp = signal<ImportReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly productTab = signal<ProductTab>('ban_chay');
  readonly impTab = signal<ImportTab>('nha_cung_cap');

  private seq = 0;

  readonly range = computed<{ tu: string; den: string; nhom: Group } | null>(() => {
    switch (this.mode()) {
      case 'ngay': {
        const d = this.day();
        return d ? { tu: d, den: d, nhom: 'gio' } : null;
      }
      case 'thang': {
        const m = this.month();
        if (!/^\d{4}-\d{2}$/.test(m)) return null;
        const [y, mo] = m.split('-').map(Number);
        return { tu: `${m}-01`, den: formatDate(new Date(y, mo, 0)), nhom: 'ngay' };
      }
      case 'nam': {
        const y = this.year();
        if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
        return { tu: `${y}-01-01`, den: `${y}-12-31`, nhom: 'thang' };
      }
      default: {
        const f = this.from();
        const t = this.to();
        if (!f || !t || t < f) return null;
        const days = Math.round((parseDate(t).getTime() - parseDate(f).getTime()) / 86400000) + 1;
        return { tu: f, den: t, nhom: days <= 62 ? 'ngay' : 'thang' };
      }
    }
  });

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'ngay':
        return `Ngày ${displayDate(this.day())}`;
      case 'thang': {
        const [y, m] = this.month().split('-');
        return `Tháng ${m}/${y}`;
      }
      case 'nam':
        return `Năm ${this.year()}`;
      default:
        return `Từ ${displayDate(this.from())} đến ${displayDate(this.to())}`;
    }
  });

  readonly chartTitle = computed(() => {
    const g = this.data()?.ky.nhom;
    return g === 'gio' ? 'Doanh thu theo giờ' : g === 'thang' ? 'Doanh thu theo tháng' : 'Doanh thu theo ngày';
  });

  readonly impChartTitle = computed(() => {
    const g = this.imp()?.ky.nhom;
    return g === 'gio' ? 'Tiền nhập hàng theo giờ' : g === 'thang' ? 'Tiền nhập hàng theo tháng' : 'Tiền nhập hàng theo ngày';
  });

  // Chỉ cho tiến tới kỳ chưa vượt quá hôm nay
  readonly canNext = computed(() => {
    switch (this.mode()) {
      case 'ngay':
        return this.day() < this.today;
      case 'thang':
        return this.month() < this.today.slice(0, 7);
      case 'nam':
        return this.year() < new Date().getFullYear();
      default:
        return false;
    }
  });

  readonly productTabs = computed<{ key: ProductTab; label: string }[]>(() => [
    { key: 'ban_chay', label: 'Bán chạy nhất' },
    ...(this.data()?.quyen.xem_loi_nhuan ? [{ key: 'sinh_loi' as const, label: 'Sinh lời nhất' }] : []),
    { key: 'ban_cham', label: 'Bán chậm nhất' },
  ]);

  // So sánh với kỳ trước
  readonly changes = computed(() => {
    const d = this.data();
    if (!d) return null;
    const t = d.tong_hop;
    const p = d.tong_hop_truoc;
    return {
      rev: this.change(t.doanh_thu, p.doanh_thu),
      profit: d.quyen.xem_loi_nhuan ? this.change(t.loi_nhuan ?? 0, p.loi_nhuan ?? 0) : null,
      inv: this.change(t.so_hoa_don, p.so_hoa_don),
      avg: this.change(t.trung_binh, p.trung_binh),
    };
  });

  readonly impChanges = computed(() => {
    const m = this.imp();
    if (!m) return null;
    return {
      value: this.change(m.tong_hop.gia_tri, m.tong_hop_truoc.gia_tri),
      phieu: this.change(m.tong_hop.so_phieu, m.tong_hop_truoc.so_phieu),
    };
  });

  // Trong 100 đồng doanh thu: bao nhiêu là giá vốn, bao nhiêu là lợi nhuận
  readonly split = computed(() => {
    const d = this.data();
    if (!d?.quyen.xem_loi_nhuan || !d.tong_hop.doanh_thu) return null;

    const revenue = d.tong_hop.doanh_thu;
    const cost = d.tong_hop.gia_von ?? 0;
    const profit = d.tong_hop.loi_nhuan ?? 0;
    const costPct = round1(Math.min(100, Math.max(0, (cost / revenue) * 100)));

    return {
      cost,
      costPct,
      profitPct: profit >= 0 ? round1(100 - costPct) : 0,
      loss: profit < 0,
    };
  });

  readonly chart = computed(() => {
    const d = this.data();
    const showProfit = !!d?.quyen.xem_loi_nhuan;

    return buildChart(
      (d?.chuoi ?? []).map((p) => ({
        label: p.nhan,
        value: p.doanh_thu,
        tip: `${p.nhan}: ${money(p.doanh_thu)} ₫ (${p.so_hoa_don} hóa đơn)`,
        line: p.loi_nhuan ?? 0,
        lineTip: `${p.nhan}: lợi nhuận ${money(p.loi_nhuan ?? 0)} ₫`,
      })),
      showProfit,
    );
  });

  readonly impChart = computed(() =>
    buildChart(
      (this.imp()?.chuoi ?? []).map((p) => ({
        label: p.nhan,
        value: p.gia_tri,
        tip: `${p.nhan}: ${money(p.gia_tri)} ₫ (${p.so_phieu} phiếu nhập)`,
      })),
      false,
    ),
  );

  constructor() {
    this.load();
  }

  setView(v: View) {
    if (v === 'nhap_hang' && !this.canImport()) return;
    this.view.set(v);
    this.load();
  }

  setMode(m: Mode) {
    this.mode.set(m);
    this.load();
  }

  onDay(v: string) {
    if (!v) return;
    this.day.set(v);
    this.load();
  }

  onMonth(v: string) {
    if (!v) return;
    this.month.set(v);
    this.load();
  }

  onYear(v: string) {
    const y = Math.floor(Number(v));
    if (!Number.isFinite(y)) return;
    this.year.set(Math.min(2100, Math.max(2000, y)));
    this.load();
  }

  // Lùi (-1) hoặc tiến (+1) một kỳ theo chế độ đang chọn
  shift(dir: 1 | -1) {
    switch (this.mode()) {
      case 'ngay': {
        const next = addDays(this.day(), dir);
        if (next <= this.today) {
          this.day.set(next);
          this.load();
        }
        break;
      }
      case 'thang': {
        const [y, m] = this.month().split('-').map(Number);
        const d = new Date(y, m - 1 + dir, 1);
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (next <= this.today.slice(0, 7)) {
          this.month.set(next);
          this.load();
        }
        break;
      }
      case 'nam': {
        const y = this.year() + dir;
        if (y >= 2000 && y <= new Date().getFullYear()) {
          this.year.set(y);
          this.load();
        }
        break;
      }
    }
  }

  load() {
    const r = this.range();
    if (!r) {
      this.error.set(
        this.mode() === 'tuy_chon'
          ? 'Hãy chọn đủ hai ngày và ngày kết thúc phải từ ngày bắt đầu trở đi.'
          : 'Khoảng thời gian không hợp lệ.',
      );
      return;
    }

    const id = ++this.seq;
    this.loading.set(true);
    this.error.set(null);

    if (this.view() === 'nhap_hang') {
      this.service.imports(r.tu, r.den, r.nhom).subscribe({
        next: (d) => {
          if (id !== this.seq) return; // bỏ qua phản hồi cũ
          this.imp.set(d);
          this.loading.set(false);
        },
        error: (e: HttpErrorResponse) => this.fail(id, e),
      });
      return;
    }

    this.service.revenue(r.tu, r.den, r.nhom).subscribe({
      next: (d) => {
        if (id !== this.seq) return;
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => this.fail(id, e),
    });
  }

  percent(v: number): number {
    const total = this.data()?.tong_hop.doanh_thu ?? 0;
    return total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
  }

  impPercent(v: number): number {
    const total = this.imp()?.tong_hop.gia_tri ?? 0;
    return total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
  }

  private fail(id: number, e: HttpErrorResponse) {
    if (id !== this.seq) return;
    this.loading.set(false);
    const errs = e.error?.errors as Record<string, string[]> | undefined;
    this.error.set(
      errs ? Object.values(errs).flat().join(' ') : (e.error?.message ?? 'Không tải được báo cáo.'),
    );
  }

  private change(cur: number, prev: number): Change | null {
    if (!prev) return cur > 0 ? { text: 'Mới phát sinh trong kỳ này', up: true } : null;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return {
      text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước`,
      up: pct >= 0,
    };
  }
}
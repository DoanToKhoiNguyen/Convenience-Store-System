import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePickerModule } from 'primeng/datepicker';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { addDays, displayDate, formatDate, parseDate } from '../shifts/week.util';
import { Group, ImportReport, RevenueReport } from './report.model';
import { ReportService } from './report.service';

type View = 'doanh_thu' | 'nhap_hang';
type Mode = 'ngay' | 'tuan' | 'thang' | 'nam' | 'tuy_chon';
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

// Thứ 2 của tuần chứa ngày s (tuần Việt Nam bắt đầu thứ 2)
const mondayOf = (s: string): string => addDays(s, -((parseDate(s).getDay() + 6) % 7));

// Chuỗi cho <input type="week">: năm-tuần theo ISO-8601 (W01 là tuần chứa 4/1)
function weekValueOf(monday: string): string {
  const thu = parseDate(monday);
  thu.setDate(thu.getDate() + 3);
  const year = thu.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Mon = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7));
  const week = Math.round((thu.getTime() - week1Mon.getTime()) / 604800000) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function mondayOfWeekValue(v: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const jan4 = new Date(year, 0, 4);
  const week1Mon = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7));
  const d = new Date(week1Mon);
  d.setDate(week1Mon.getDate() + (Number(m[2]) - 1) * 7);
  return formatDate(d);
}

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
  imports: [DatePipe, NgTemplateOutlet, FormsModule, DatePickerModule],
  template: `
    <!-- Tiêu đề -->
    <div class="mb-4">
      <h1 class="text-2xl font-semibold text-slate-800">
        {{ view() === 'doanh_thu' ? 'Báo cáo doanh thu' : 'Báo cáo nhập hàng' }}
      </h1>
      <p class="text-sm text-slate-500">{{ title() }}</p>
    </div>

    <!-- Bộ lọc thời gian -->
    <section class="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
      <div class="inline-flex rounded-xl bg-slate-100 p-1">
        @for (m of modes; track m.key) {
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
            [class]="mode() === m.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
            (click)="setMode(m.key)"
          >
            {{ m.label }}
          </button>
        }
      </div>

      <div class="hidden h-7 w-px bg-slate-200 sm:block"></div>

      @if (mode() !== 'tuy_chon') {
        <div class="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/70">
          <span class="pl-3 pr-1 text-xs font-semibold text-slate-500">{{ pickerLabel() }}</span>
          <button
            type="button"
            class="px-2.5 py-2 text-slate-500 hover:text-indigo-700"
            aria-label="Kỳ trước"
            (click)="shift(-1)"
          >
            <i class="pi pi-angle-left"></i>
          </button>

          @switch (mode()) {
            @case ('ngay') {
              <p-datepicker
                [ngModel]="dayDate()"
                (onSelect)="onDayPick($event)"
                [maxDate]="maxDay"
                dateFormat="dd/mm/yy"
                placeholder="Chọn ngày"
                [readonlyInput]="true"
                [appendTo]="'body'"
                inputStyleClass="!w-28 !border-0 !bg-transparent !py-2.5 !text-center !text-sm !font-medium !text-slate-800 !shadow-none"
              />
            }
            @case ('tuan') {
              <input
                type="week"
                aria-label="Chọn tuần"
                class="w-36 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
                [value]="weekValue()"
                [max]="maxWeekValue()"
                (change)="onWeekInput($event)"
              />
            }
            @case ('thang') {
              <input
                type="month"
                aria-label="Chọn tháng"
                class="w-36 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
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
                aria-label="Chọn năm"
                class="w-20 border-0 bg-transparent py-2 text-center text-sm font-medium text-slate-800 focus:outline-none"
                [value]="year()"
                (change)="onYear($any($event.target).value)"
              />
            }
          }

          <button
            type="button"
            class="px-2.5 py-2 text-slate-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-500"
            aria-label="Kỳ sau"
            [disabled]="!canNext()"
            (click)="shift(1)"
          >
            <i class="pi pi-angle-right"></i>
          </button>
        </div>
      } @else {
        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
          <input type="date" aria-label="Từ ngày" class="border-0 bg-transparent text-sm focus:outline-none" [value]="from()" [max]="today" (change)="from.set($any($event.target).value)" />
          <i class="pi pi-arrow-right text-xs text-slate-400"></i>
          <input type="date" aria-label="Đến ngày" class="border-0 bg-transparent text-sm focus:outline-none" [value]="to()" [max]="today" (change)="to.set($any($event.target).value)" />
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            (click)="load()"
          >
            Xem
          </button>
        </div>
      }

      <button
        type="button"
        class="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        title="Tải lại"
        aria-label="Tải lại"
        [disabled]="loading()"
        (click)="load()"
      >
        <i class="text-sm" [class]="loading() ? 'pi pi-refresh animate-spin' : 'pi pi-refresh'"></i>
      </button>
    </section>

    <!-- Chuyển giữa các báo cáo (chỉ chủ thấy tab Nhập hàng) -->
    @if (canImport()) {
      <div class="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        @for (v of views; track v.key) {
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition"
            [class]="view() === v.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
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
          <!-- Dải tổng quan: doanh thu + chỉ số phụ -->
          <section class="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2 text-sm font-medium text-indigo-50">
                  <i class="pi pi-wallet"></i>
                  Doanh thu
                  @if (changes()?.rev; as c) {
                    <span
                      class="rounded-full px-2.5 py-1 text-xs font-medium"
                      [class]="c.up ? 'bg-white/20 text-white' : 'bg-red-900/40 text-red-100'"
                    >
                      {{ c.text }}
                    </span>
                  }
                </div>
                <div class="mt-2 break-words text-3xl font-bold sm:text-4xl">{{ money(d.tong_hop.doanh_thu) }} ₫</div>
                <p class="mt-2 text-sm text-indigo-50">
                  Tiền thực thu từ {{ d.tong_hop.so_hoa_don }} hóa đơn đã thanh toán
                </p>
              </div>

              <div class="grid w-full grid-cols-3 gap-3 sm:w-auto">
                <div class="rounded-xl bg-white/10 px-4 py-3">
                  <div class="text-xs text-indigo-100">Số hóa đơn</div>
                  <div class="mt-0.5 text-lg font-semibold">{{ d.tong_hop.so_hoa_don.toLocaleString('vi-VN') }}</div>
                  @if (changes()?.inv; as c) {
                    <div class="text-xs" [class]="c.up ? 'text-indigo-100' : 'text-red-100'">{{ c.text }}</div>
                  }
                </div>
                <div class="rounded-xl bg-white/10 px-4 py-3">
                  <div class="text-xs text-indigo-100">Trung bình/hóa đơn</div>
                  <div class="mt-0.5 text-lg font-semibold">{{ money(d.tong_hop.trung_binh) }} ₫</div>
                  @if (changes()?.avg; as c) {
                    <div class="text-xs" [class]="c.up ? 'text-indigo-100' : 'text-red-100'">{{ c.text }}</div>
                  }
                </div>
                <div class="rounded-xl bg-white/10 px-4 py-3">
                  <div class="text-xs text-indigo-100">Giảm giá đã cho</div>
                  <div class="mt-0.5 text-lg font-semibold">{{ money(d.tong_hop.giam_gia) }} ₫</div>
                  <div class="text-xs text-indigo-100">Chi phí khuyến mãi</div>
                </div>
              </div>
            </div>
          </section>

          <!-- Ba chỉ số chính (chỉ chủ: liên quan giá vốn / hao hụt) -->
          @if (kpi(); as k) {
            <div class="mt-4 grid gap-4 md:grid-cols-3">
              <section class="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-300">Lợi nhuận gộp</span>
                  <i class="pi pi-chart-line text-slate-400"></i>
                </div>
                <div
                  class="mt-2 break-words text-2xl font-bold sm:text-3xl"
                  [class]="(d.tong_hop.loi_nhuan ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'"
                >
                  {{ money(d.tong_hop.loi_nhuan ?? 0) }} ₫
                </div>

                <div class="mt-3 flex flex-wrap gap-2 text-xs">
                  @if (changes()?.profit; as c) {
                    <span
                      class="inline-flex rounded-full px-2.5 py-1 font-medium"
                      [class]="c.up ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'"
                    >
                      {{ c.text }}
                    </span>
                  }
                  <span class="inline-flex rounded-full bg-white/10 px-2.5 py-1 font-medium text-slate-200">
                    Biên lợi nhuận {{ (d.tong_hop.bien_loi_nhuan ?? 0).toLocaleString('vi-VN') }}%
                  </span>
                </div>

                @if (split(); as s) {
                  <div class="mt-4">
                    <div class="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div class="h-full bg-slate-400" [style.width.%]="s.costPct"></div>
                      <div class="h-full bg-emerald-400" [style.width.%]="s.profitPct"></div>
                    </div>
                    <div class="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-300">
                      <span>Giá vốn {{ money(s.cost) }} ₫ ({{ s.costPct.toLocaleString('vi-VN') }}%)</span>
                      <span [class]="s.loss ? 'text-red-300' : ''">
                        {{ s.loss ? 'Đang lỗ' : 'Lợi nhuận ' + s.profitPct.toLocaleString('vi-VN') + '%' }}
                      </span>
                    </div>
                  </div>
                }
              </section>

              <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-100">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-500">Hao hụt</span>
                  <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <i class="pi pi-trash text-sm"></i>
                  </span>
                </div>
                <div class="mt-2 break-words text-2xl font-bold text-red-600 sm:text-3xl">{{ k.huy > 0 ? '−' : '' }}{{ money(k.huy) }} ₫</div>
                <p class="mt-1 text-xs text-slate-500">
                  {{ k.soLo }} lô · {{ k.soLuong.toLocaleString('vi-VN') }} sản phẩm bị loại trong kỳ
                </p>
                @if (k.huyChange; as c) {
                  <span
                    class="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                    [class]="c.up ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'"
                  >
                    {{ c.text }}
                  </span>
                }
              </section>

              <section class="rounded-2xl bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-500">Lãi thực sau hao hụt</span>
                  <i class="pi pi-verified text-slate-300"></i>
                </div>
                <div
                  class="mt-2 break-words text-2xl font-bold sm:text-3xl"
                  [class]="k.amThuc ? 'text-red-600' : 'text-emerald-700'"
                >
                  {{ money(k.laiThuc) }} ₫
                </div>
                <p class="mt-1 text-xs text-slate-500">Lợi nhuận gộp − hao hụt</p>
                @if (k.laiThucChange; as c) {
                  <span
                    class="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                    [class]="c.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'"
                  >
                    {{ c.text }}
                  </span>
                }
              </section>
            </div>
          }

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
                <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-indigo-500"></span>Doanh thu</span>
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
                [ngTemplateOutletContext]="{ $implicit: chart(), color: '#6366f1' }"
              ></ng-container>
            }
          </section>

          <!-- Tiền đi đâu: doanh thu chia thành vốn, hao hụt, lãi thực -->
          @if (phanBo(); as b) {
            <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-semibold text-slate-800">Tiền đi đâu?</h2>
                <span class="text-xs text-slate-400">Doanh thu được chia thành vốn, hao hụt và lãi thực</span>
              </div>
              <div class="flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-slate-400" [style.width.%]="b.vonPct"></div>
                <div class="h-full bg-red-400" [style.width.%]="b.huyPct"></div>
                @if (!b.am) {
                  <div class="h-full bg-emerald-500" [style.width.%]="b.laiPct"></div>
                }
              </div>
              <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div class="flex items-center gap-1.5 text-xs text-slate-500">
                    <span class="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400"></span>Giá vốn hàng bán
                  </div>
                  <div class="mt-0.5 font-semibold text-slate-800">{{ money(b.von) }} ₫</div>
                  <div class="text-xs text-slate-400">{{ b.vonCua.toLocaleString('vi-VN') }}% doanh thu</div>
                </div>
                <div>
                  <div class="flex items-center gap-1.5 text-xs text-slate-500">
                    <span class="inline-block h-2.5 w-2.5 rounded-sm bg-red-400"></span>Hao hụt
                  </div>
                  <div class="mt-0.5 font-semibold text-red-600">{{ money(b.huy) }} ₫</div>
                  <div class="text-xs text-slate-400">{{ b.huyCua.toLocaleString('vi-VN') }}% doanh thu</div>
                </div>
                <div>
                  <div class="flex items-center gap-1.5 text-xs text-slate-500">
                    <span class="inline-block h-2.5 w-2.5 rounded-sm" [class]="b.am ? 'bg-amber-400' : 'bg-emerald-500'"></span>
                    Lãi thực sau hao hụt
                  </div>
                  <div class="mt-0.5 font-semibold" [class]="b.am ? 'text-red-600' : 'text-emerald-700'">{{ money(b.lai) }} ₫</div>
                  <div class="text-xs text-slate-400">{{ b.laiCua.toLocaleString('vi-VN') }}% doanh thu</div>
                </div>
              </div>
              @if (b.am) {
                <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <i class="pi pi-exclamation-triangle mt-0.5"></i>
                  Giá vốn và hao hụt vượt doanh thu trong kỳ này.
                </p>
              }
            </section>
          }

          <!-- Hao hụt theo lô (chỉ chủ thấy giá vốn) -->
          @if (hetHan(); as hh) {
            <section class="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
                    <i class="pi pi-trash"></i>
                  </span>
                  <div>
                    <h2 class="font-semibold text-slate-800">Hao hụt theo lô</h2>
                    <p class="text-xs text-slate-500">Lô hết hạn tự động bị loại hoặc bị giảm tại trang Cập nhật tồn kho trong kỳ</p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">{{ hh.tong.so_lo }} lô</span>
                  <span class="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                    {{ hh.tong.so_luong_loai.toLocaleString('vi-VN') }} sản phẩm
                  </span>
                  <span class="rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-600">{{ hh.tong.lo_huy > 0 ? '−' : '' }}{{ money(hh.tong.lo_huy) }} ₫</span>
                </div>
              </div>

              @if (hh.tong.so_lo === 0) {
                <div class="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
                  <i class="pi pi-check-circle text-4xl text-emerald-300"></i>
                  <p class="text-sm">Không có lô hàng nào bị loại trong kỳ này.</p>
                </div>
              } @else {
                <div class="grid gap-5 p-5 lg:grid-cols-2">
                  <div>
                    <h3 class="mb-2 text-sm font-medium text-slate-600">Giá trị lỗ theo {{ lossChartDonVi() }}</h3>
                    <ng-container
                      [ngTemplateOutlet]="chartTpl"
                      [ngTemplateOutletContext]="{ $implicit: huyChart(), color: '#ef4444' }"
                    ></ng-container>
                  </div>
                  <div>
                    <h3 class="mb-3 text-sm font-medium text-slate-600">Sản phẩm thiệt hại nhiều nhất</h3>
                    @for (p of hh.san_pham; track p.MaSanPham) {
                      <div class="mb-3 last:mb-0">
                        <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span class="truncate font-medium text-slate-700">{{ p.TenSanPham }}</span>
                          <span class="shrink-0 text-red-600">
                            {{ money(p.gia_tri) }} ₫ <span class="text-slate-400">· {{ p.so_luong }} cái</span>
                          </span>
                        </div>
                        <div class="h-2 rounded-full bg-slate-100">
                          <div class="h-2 rounded-full bg-red-400" [style.width.%]="huyPercent(p.gia_tri)"></div>
                        </div>
                      </div>
                    } @empty {
                      <p class="text-sm text-slate-400">Chưa có dữ liệu.</p>
                    }
                  </div>
                </div>

                <div class="overflow-x-auto px-5 pb-5">
                  <table class="w-full min-w-[54rem] text-sm">
                    <thead>
                      <tr class="border-b text-left text-slate-500">
                        <th class="py-2">Lô</th>
                        <th>Sản phẩm</th>
                        <th>HSD</th>
                        <th class="text-right">SL nhập</th>
                        <th class="text-right">Đã bán</th>
                        <th class="text-right">Doanh thu lô</th>
                        <th class="text-right">Giá trị nhập</th>
                        <th class="text-right">Hao hụt</th>
                        <th class="text-right">Lãi/lỗ</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (l of hh.theo_lo; track l.MaLoHang) {
                        <tr class="border-b border-slate-100 align-top">
                          <td class="py-2.5">
                            <div class="font-medium text-slate-800">{{ l.MaLo }}</div>
                            <div class="text-xs text-slate-400">Loại {{ l.ThoiGianLoai }}</div>
                          </td>
                          <td class="text-slate-700">{{ l.TenSanPham }}</td>
                          <td class="whitespace-nowrap text-slate-600">{{ l.HanSuDung ? displayDate(l.HanSuDung) : '—' }}</td>
                          <td class="text-right">{{ l.SoLuongNhap.toLocaleString('vi-VN') }}</td>
                          <td class="text-right">{{ l.so_luong_ban.toLocaleString('vi-VN') }}</td>
                          <td class="text-right">{{ money(l.doanh_thu) }} ₫</td>
                          <td class="text-right text-slate-500">{{ money(l.gia_tri_nhap) }} ₫</td>
                          <td class="text-right font-medium text-red-600">−{{ money(l.lo_huy) }} ₫</td>
                          <td class="text-right font-semibold" [class]="l.lai >= 0 ? 'text-indigo-700' : 'text-red-600'">
                            {{ money(l.lai) }} ₫
                          </td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="bg-slate-50 font-semibold text-slate-700">
                        <td class="py-2.5" colspan="3">Tổng cộng</td>
                        <td class="text-right">{{ hh.tong.so_luong_nhap.toLocaleString('vi-VN') }}</td>
                        <td class="text-right">{{ hh.tong.so_luong_ban.toLocaleString('vi-VN') }}</td>
                        <td class="text-right">{{ money(hh.tong.doanh_thu) }} ₫</td>
                        <td class="text-right">{{ money(hh.tong.gia_tri_nhap) }} ₫</td>
                        <td class="text-right text-red-600">{{ hh.tong.lo_huy > 0 ? '−' : '' }}{{ money(hh.tong.lo_huy) }} ₫</td>
                        <td class="text-right" [class]="hh.tong.lai >= 0 ? 'text-indigo-700' : 'text-red-600'">
                          {{ money(hh.tong.lai) }} ₫
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <p class="mt-2 text-xs text-slate-400">
                    Doanh thu lô tính trên toàn bộ hóa đơn đã thanh toán có bán từ lô này (kể cả trước kỳ báo cáo).
                    Lãi/lỗ = doanh thu − vốn phần đã bán − giá trị phần bị loại. Một lô bị ghi nhận nhiều lần trong kỳ
                    được gộp thành một dòng, thời gian hiển thị là lần gần nhất.
                  </p>
                </div>
              }
            </section>
          }

          <!-- Sản phẩm -->
          <section class="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div class="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
              @for (t of productTabs(); track t.key) {
                <button
                  type="button"
                  class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
                  [class]="productTab() === t.key
                    ? 'border-indigo-600 text-indigo-700'
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
                        <td class="text-right font-medium" [class]="(p.loi_nhuan ?? 0) >= 0 ? 'text-indigo-700' : 'text-red-600'">
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
                <p>
                  <b>Hao hụt</b> = số lượng hàng bị loại × đơn giá nhập của lô. Hàng bị loại gồm lô hết hạn được hệ thống
                  tự loại và phần tồn kho bị giảm tại trang Cập nhật tồn kho, tính theo thời điểm ghi nhận.
                  <b>Lãi thực sau hao hụt</b> = lợi nhuận gộp − hao hụt.
                </p>
                <p>
                  Với từng lô trong bảng hao hụt: <b>doanh thu lô</b> là phần tiền của các hóa đơn đã thanh toán có bán từ lô đó;
                  <b>lãi/lỗ</b> = doanh thu lô − vốn phần đã bán − giá trị phần bị loại.
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
  readonly maxDay = parseDate(this.today);

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
    { key: 'tuan', label: 'Tuần' },
    { key: 'thang', label: 'Tháng' },
    { key: 'nam', label: 'Năm' },
    { key: 'tuy_chon', label: 'Tùy chọn' },
  ];

  readonly view = signal<View>('doanh_thu');
  readonly mode = signal<Mode>('thang');
  readonly day = signal(this.today);
  readonly weekStart = signal(mondayOf(this.today));
  readonly month = signal(this.today.slice(0, 7));
  readonly year = signal(new Date().getFullYear());
  readonly from = signal(addDays(this.today, -6));
  readonly to = signal(this.today);
  readonly dayDate = computed(() => parseDate(this.day()));
  readonly weekValue = computed(() => weekValueOf(this.weekStart()));
  readonly maxWeekValue = computed(() => weekValueOf(mondayOf(this.today)));
  readonly pickerLabel = computed(
    () => ({ ngay: 'Chọn ngày', tuan: 'Chọn tuần', thang: 'Chọn tháng', nam: 'Chọn năm', tuy_chon: '' })[this.mode()],
  );

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
      case 'tuan': {
        const start = this.weekStart();
        return { tu: start, den: addDays(start, 6), nhom: 'ngay' };
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
      case 'tuan': {
        const [, sm, sd] = this.weekStart().split('-');
        return `Tuần ${sd}/${sm} – ${displayDate(addDays(this.weekStart(), 6))}`;
      }
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
      case 'tuan':
        return this.weekStart() < mondayOf(this.today);
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

  // Ba chỉ số chính của chủ: lợi nhuận gộp (dùng tong_hop), hao hụt, lãi thực sau hao hụt
  readonly kpi = computed(() => {
    const d = this.data();
    if (!d?.quyen.xem_loi_nhuan) return null;
    const huy = d.tong_hop.gia_tri_huy ?? 0;
    const laiThuc = d.tong_hop.lai_sau_huy ?? 0;

    return {
      huy,
      huyChange: this.change(huy, d.tong_hop_truoc.gia_tri_huy ?? 0),
      laiThuc,
      laiThucChange: this.change(laiThuc, d.tong_hop_truoc.lai_sau_huy ?? 0),
      soLo: d.het_han?.tong.so_lo ?? 0,
      soLuong: d.het_han?.tong.so_luong_loai ?? 0,
      amThuc: laiThuc < 0,
    };
  });

  readonly hetHan = computed(() => this.data()?.het_han ?? null);

  readonly lossChartDonVi = computed(() => {
    const g = this.data()?.ky.nhom;
    return g === 'gio' ? 'giờ' : g === 'thang' ? 'tháng' : 'ngày';
  });

  readonly huyChart = computed(() =>
    buildChart(
      (this.hetHan()?.chuoi ?? []).map((p) => ({
        label: p.nhan,
        value: p.gia_tri,
        tip: `${p.nhan}: lỗ ${money(p.gia_tri)} ₫`,
      })),
      false,
    ),
  );

  // Thanh xếp lớp "Tiền đi đâu": tỉ lệ tính trên doanh thu, nhưng nếu vốn + hao hụt vượt doanh thu
  // thì lấy tổng chi phí làm mốc để thanh không tràn khỏi khung
  readonly phanBo = computed(() => {
    const d = this.data();
    if (!d?.quyen.xem_loi_nhuan || !d.tong_hop.doanh_thu) return null;

    const rev = d.tong_hop.doanh_thu;
    const von = d.tong_hop.gia_von ?? 0;
    const huy = d.tong_hop.gia_tri_huy ?? 0;
    const lai = d.tong_hop.lai_sau_huy ?? 0;
    const base = Math.max(rev, von + huy, 1);

    const rong = (v: number) => round1((Math.max(0, v) / base) * 100);
    const cua = (v: number) => round1((v / rev) * 100);

    return {
      von,
      huy,
      lai,
      vonPct: rong(von),
      huyPct: rong(huy),
      laiPct: rong(lai),
      vonCua: cua(von),
      huyCua: cua(huy),
      laiCua: cua(lai),
      am: lai < 0,
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

  onDayPick(d: Date) {
    if (!(d instanceof Date)) return;
    this.onDay(formatDate(d));
  }

  onWeekInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const start = mondayOfWeekValue(el.value);
    // Ô week là uncontrolled: nếu tuần chọn không hợp lệ/vượt hôm nay thì trả lại giá trị đang xem
    if (!start || start > mondayOf(this.today)) {
      el.value = this.weekValue();
      return;
    }
    this.weekStart.set(start);
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
      case 'tuan': {
        const next = addDays(this.weekStart(), dir * 7);
        if (next <= mondayOf(this.today)) {
          this.weekStart.set(next);
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

  // Tỉ lệ thiệt hại của một sản phẩm trong tổng giá trị lỗ hết hạn
  huyPercent(v: number): number {
    const tong = this.hetHan()?.tong.lo_huy ?? 0;
    return tong > 0 ? Math.round((v / tong) * 1000) / 10 : 0;
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
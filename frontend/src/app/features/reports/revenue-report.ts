import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { addDays, displayDate, formatDate, parseDate } from '../shifts/week.util';
import { Group, RevenueReport } from './report.model';
import { ReportService } from './report.service';

type Mode = 'ngay' | 'thang' | 'nam' | 'tuy_chon';

interface Card {
    label: string;
    value: string;
    note?: string;
    change?: { text: string; up: boolean } | null;
    tone: 'emerald' | 'amber' | 'sky' | 'slate' | 'rose';
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

@Component({
    selector: 'app-revenue-report',
    imports: [ButtonModule],
    template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Báo cáo doanh thu</h1>
        <p class="text-sm text-slate-500">{{ title() }}</p>
      </div>
      <p-button label="Tải lại" icon="pi pi-refresh" [outlined]="true" [loading]="loading()" (onClick)="load()" />
    </div>

    <!-- Bộ lọc thời gian -->
    <div class="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div class="flex flex-wrap gap-2">
        @for (m of modes; track m.key) {
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium"
            [class]="mode() === m.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            (click)="setMode(m.key)"
          >
            {{ m.label }}
          </button>
        }
      </div>

      @switch (mode()) {
        @case ('ngay') {
          <input
            type="date"
            class="rounded-md border border-slate-300 px-3 py-2"
            [value]="day()"
            [max]="today"
            (change)="onDay($any($event.target).value)"
          />
        }
        @case ('thang') {
          <input
            type="month"
            class="rounded-md border border-slate-300 px-3 py-2"
            [value]="month()"
            [max]="today.slice(0, 7)"
            (change)="onMonth($any($event.target).value)"
          />
        }
        @case ('nam') {
          <div class="flex items-center gap-1">
            <button type="button" class="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-50" (click)="shiftYear(-1)">‹</button>
            <input
              type="number"
              min="2000"
              max="2100"
              class="w-24 rounded-md border border-slate-300 px-3 py-2 text-center"
              [value]="year()"
              (change)="onYear($any($event.target).value)"
            />
            <button type="button" class="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-50" (click)="shiftYear(1)">›</button>
          </div>
        }
        @case ('tuy_chon') {
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-sm text-slate-600">Từ</label>
            <input type="date" class="rounded-md border border-slate-300 px-3 py-2" [value]="from()" [max]="today" (change)="from.set($any($event.target).value)" />
            <label class="text-sm text-slate-600">đến</label>
            <input type="date" class="rounded-md border border-slate-300 px-3 py-2" [value]="to()" [max]="today" (change)="to.set($any($event.target).value)" />
            <p-button label="Xem báo cáo" icon="pi pi-search" (onClick)="load()" />
          </div>
        }
      }
    </div>

    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    @if (data(); as d) {
      <div [class.opacity-60]="loading()">
        <!-- Thẻ tổng quan -->
        <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (c of cards(); track c.label) {
            <div class="rounded-xl bg-white p-4 shadow-sm">
              <div class="text-sm text-slate-500">{{ c.label }}</div>
              <div class="mt-1 text-2xl font-semibold" [class]="toneClass(c.tone)">{{ c.value }}</div>
              @if (c.change) {
                <div class="mt-1 text-xs" [class]="c.change.up ? 'text-emerald-600' : 'text-red-600'">
                  {{ c.change.text }} so với kỳ trước
                </div>
              }
              @if (c.note) {
                <div class="mt-1 text-xs text-slate-500">{{ c.note }}</div>
              }
            </div>
          }
        </div>

        @if (d.dang_cho.so_hoa_don > 0) {
          <div class="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Đang có <b>{{ d.dang_cho.so_hoa_don }}</b> hóa đơn chờ thanh toán (hàng đang được giữ), tổng
            <b>{{ money(d.dang_cho.tong_tien) }} ₫</b>. Các hóa đơn này chưa tính vào doanh thu.
          </div>
        }

        <!-- Biểu đồ -->
        <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-medium text-slate-700">{{ chartTitle() }}</h2>
            <div class="flex items-center gap-4 text-xs text-slate-600">
              <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-sm bg-emerald-500"></span>Doanh thu</span>
              @if (d.quyen.xem_loi_nhuan) {
                <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full bg-amber-500"></span>Lợi nhuận gộp</span>
              }
            </div>
          </div>

          @if (d.tong_hop.so_hoa_don === 0) {
            <p class="py-12 text-center text-slate-500">Chưa có hóa đơn nào được thanh toán trong khoảng thời gian này.</p>
          } @else {
            <svg [attr.viewBox]="'0 0 ' + chart().W + ' ' + chart().H" class="h-auto w-full" role="img" aria-label="Biểu đồ doanh thu">
              @for (t of chart().ticks; track $index) {
                <line [attr.x1]="chart().L" [attr.x2]="chart().W - chart().R" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#e2e8f0" stroke-width="1" />
                <text [attr.x]="chart().L - 6" [attr.y]="t.y + 4" text-anchor="end" font-size="11" fill="#64748b">{{ t.label }}</text>
              }
              <line [attr.x1]="chart().L" [attr.x2]="chart().W - chart().R" [attr.y1]="chart().zeroY" [attr.y2]="chart().zeroY" stroke="#94a3b8" stroke-width="1" />

              @for (b of chart().bars; track $index) {
                <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3" fill="#10b981">
                  <title>{{ b.tip }}</title>
                </rect>
              }

              @if (chart().line) {
                <polyline [attr.points]="chart().line" fill="none" stroke="#f59e0b" stroke-width="2" />
              }
              @for (p of chart().dots; track $index) {
                <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" fill="#f59e0b">
                  <title>{{ p.tip }}</title>
                </circle>
              }

              @for (l of chart().xlabels; track $index) {
                <text [attr.x]="l.x" [attr.y]="chart().H - 10" text-anchor="middle" font-size="11" fill="#64748b">{{ l.text }}</text>
              }
            </svg>
          }
        </div>

        <div class="mb-4 grid gap-4 lg:grid-cols-2">
          <!-- Phương thức thanh toán -->
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <h2 class="mb-3 font-medium text-slate-700">Doanh thu theo phương thức thanh toán</h2>
            @for (m of d.phuong_thuc; track m.ten) {
              <div class="mb-3">
                <div class="mb-1 flex justify-between text-sm">
                  <span class="text-slate-700">{{ m.ten }} <span class="text-slate-400">({{ m.so_hoa_don }} hóa đơn)</span></span>
                  <span class="font-medium text-slate-800">{{ money(m.doanh_thu) }} ₫ · {{ percent(m.doanh_thu) }}%</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100">
                  <div class="h-2 rounded-full bg-emerald-500" [style.width.%]="percent(m.doanh_thu)"></div>
                </div>
              </div>
            } @empty {
              <p class="text-sm text-slate-500">Chưa có dữ liệu.</p>
            }
          </div>

          <!-- Theo nhân viên -->
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <h2 class="mb-3 font-medium text-slate-700">Doanh thu theo nhân viên</h2>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-slate-500">
                  <th class="py-2">Nhân viên</th>
                  <th class="text-right">Hóa đơn</th>
                  <th class="text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                @for (s of d.nhan_vien; track s.MaTaiKhoan) {
                  <tr class="border-b border-slate-100">
                    <td class="py-2 font-medium text-slate-800">{{ s.HoTen }}</td>
                    <td class="text-right">{{ s.so_hoa_don }}</td>
                    <td class="text-right">{{ money(s.doanh_thu) }} ₫</td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="py-4 text-center text-slate-500">Chưa có dữ liệu.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="mb-4 grid gap-4 lg:grid-cols-2">
          <!-- Bán chạy -->
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <h2 class="mb-3 font-medium text-slate-700">Sản phẩm bán chạy nhất</h2>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-slate-500">
                  <th class="w-8 py-2">#</th>
                  <th>Sản phẩm</th>
                  <th class="text-right">SL bán</th>
                  <th class="text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                @for (p of d.ban_chay; track p.MaSanPham; let i = $index) {
                  <tr class="border-b border-slate-100">
                    <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                    <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                    <td class="text-right">{{ p.so_luong }}</td>
                    <td class="text-right">{{ money(p.doanh_thu) }} ₫</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="py-4 text-center text-slate-500">Chưa có dữ liệu.</td></tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Sinh lời (chỉ chủ) -->
          @if (d.quyen.xem_loi_nhuan) {
            <div class="rounded-xl bg-white p-4 shadow-sm">
              <h2 class="mb-3 font-medium text-slate-700">Sản phẩm sinh lời nhiều nhất</h2>
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-slate-500">
                    <th class="w-8 py-2">#</th>
                    <th>Sản phẩm</th>
                    <th class="text-right">SL bán</th>
                    <th class="text-right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of d.sinh_loi ?? []; track p.MaSanPham; let i = $index) {
                    <tr class="border-b border-slate-100">
                      <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                      <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                      <td class="text-right">{{ p.so_luong }}</td>
                      <td class="text-right" [class]="(p.loi_nhuan ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'">
                        {{ money(p.loi_nhuan ?? 0) }} ₫
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="py-4 text-center text-slate-500">Chưa có dữ liệu.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Bán chậm -->
        <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 class="mb-1 font-medium text-slate-700">Sản phẩm bán chậm nhất</h2>
          <p class="mb-3 text-xs text-slate-500">
            Sản phẩm còn hàng trong kho nhưng bán được ít nhất trong kỳ (kể cả chưa bán được cái nào).
          </p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[34rem] text-sm">
              <thead>
                <tr class="border-b text-left text-slate-500">
                  <th class="w-8 py-2">#</th>
                  <th>Sản phẩm</th>
                  <th>Loại</th>
                  <th class="text-right">Đã bán trong kỳ</th>
                  <th class="text-right">Tồn kho</th>
                  @if (d.quyen.xem_loi_nhuan) {
                    <th class="text-right">Vốn nằm trong kho</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (p of d.ban_cham; track p.MaSanPham; let i = $index) {
                  <tr class="border-b border-slate-100">
                    <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                    <td class="font-medium text-slate-800">{{ p.TenSanPham }}</td>
                    <td>{{ p.LoaiSanPham ?? '—' }}</td>
                    <td class="text-right" [class]="p.so_luong === 0 ? 'font-medium text-red-600' : ''">
                      {{ p.so_luong === 0 ? 'Chưa bán được' : p.so_luong }}
                    </td>
                    <td class="text-right">{{ p.SoLuongHienTai }}</td>
                    @if (d.quyen.xem_loi_nhuan) {
                      <td class="text-right">{{ money(p.von_ton ?? 0) }} ₫</td>
                    }
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="py-4 text-center text-slate-500">Không có sản phẩm nào.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <p class="text-xs text-slate-500">
          Doanh thu là số tiền thực thu (sau giảm giá) của các hóa đơn đã thanh toán, tính theo ngày thanh toán.
          Doanh thu theo từng sản phẩm là trước giảm giá. Kỳ trước là khoảng thời gian liền kề phía trước có cùng số ngày
          ({{ displayDate(d.ky_truoc.tu_ngay) }} – {{ displayDate(d.ky_truoc.den_ngay) }}).
          @if (d.quyen.xem_loi_nhuan) {
            Lợi nhuận gộp = doanh thu − giá vốn hàng bán (giá nhập tại lúc bán), chưa trừ lương, mặt bằng, điện nước,
            hàng hủy hoặc hết hạn.
          }
        </p>
      </div>
    } @else if (loading()) {
      <p class="text-slate-500">Đang tải báo cáo...</p>
    }
  `,
})
export class RevenueReport_ {
    private service = inject(ReportService);

    readonly money = money;
    readonly displayDate = displayDate;
    readonly today = formatDate(new Date());

    readonly modes: { key: Mode; label: string }[] = [
        { key: 'ngay', label: 'Theo ngày' },
        { key: 'thang', label: 'Theo tháng' },
        { key: 'nam', label: 'Theo năm' },
        { key: 'tuy_chon', label: 'Từ ngày – đến ngày' },
    ];

    readonly mode = signal<Mode>('thang');
    readonly day = signal(this.today);
    readonly month = signal(this.today.slice(0, 7));
    readonly year = signal(new Date().getFullYear());
    readonly from = signal(addDays(this.today, -6));
    readonly to = signal(this.today);

    readonly data = signal<RevenueReport | null>(null);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

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

    readonly cards = computed<Card[]>(() => {
        const d = this.data();
        if (!d) return [];
        const t = d.tong_hop;
        const p = d.tong_hop_truoc;

        const cards: Card[] = [
            { label: 'Doanh thu', value: `${money(t.doanh_thu)} ₫`, change: this.change(t.doanh_thu, p.doanh_thu), tone: 'emerald' },
        ];

        if (d.quyen.xem_loi_nhuan) {
            cards.push(
                {
                    label: 'Lợi nhuận gộp',
                    value: `${money(t.loi_nhuan ?? 0)} ₫`,
                    change: this.change(t.loi_nhuan ?? 0, p.loi_nhuan ?? 0),
                    tone: (t.loi_nhuan ?? 0) >= 0 ? 'amber' : 'rose',
                },
                {
                    label: 'Biên lợi nhuận',
                    value: `${(t.bien_loi_nhuan ?? 0).toLocaleString('vi-VN')}%`,
                    note: `Giá vốn hàng bán: ${money(t.gia_von ?? 0)} ₫`,
                    tone: 'slate',
                },
            );
        }

        cards.push(
            { label: 'Số hóa đơn', value: t.so_hoa_don.toLocaleString('vi-VN'), change: this.change(t.so_hoa_don, p.so_hoa_don), tone: 'sky' },
            { label: 'Trung bình mỗi hóa đơn', value: `${money(t.trung_binh)} ₫`, change: this.change(t.trung_binh, p.trung_binh), tone: 'slate' },
            { label: 'Giảm giá đã cho', value: `${money(t.giam_gia)} ₫`, note: 'Chi phí khuyến mãi trong kỳ', tone: 'slate' },
        );

        return cards;
    });

    readonly chart = computed(() => {
        const d = this.data();
        const s = d?.chuoi ?? [];
        const showProfit = !!d?.quyen.xem_loi_nhuan;

        const W = 800, H = 300, L = 62, R = 12, T = 12, B = 34;
        const iw = W - L - R;
        const ih = H - T - B;

        const values = s.flatMap((p) => (showProfit ? [p.doanh_thu, p.loi_nhuan ?? 0] : [p.doanh_thu]));
        const yMax = niceCeil(Math.max(0, ...values));
        const rawMin = Math.min(0, ...values);
        const yMin = rawMin < 0 ? -niceCeil(-rawMin) : 0;
        const span = yMax - yMin || 1;

        const y = (v: number) => T + (ih * (yMax - v)) / span;
        const n = Math.max(s.length, 1);
        const slot = iw / n;
        const bw = Math.min(slot * 0.65, 36);
        const x = (i: number) => L + slot * (i + 0.5);
        const zeroY = y(0);

        const bars = s.map((p, i) => {
            const top = y(p.doanh_thu);
            return {
                x: x(i) - bw / 2,
                y: top,
                w: bw,
                h: Math.max(zeroY - top, p.doanh_thu > 0 ? 1 : 0),
                tip: `${p.nhan}: ${money(p.doanh_thu)} ₫ (${p.so_hoa_don} hóa đơn)`,
            };
        });

        const dots = showProfit
            ? s.map((p, i) => ({
                x: x(i),
                y: y(p.loi_nhuan ?? 0),
                tip: `${p.nhan}: lợi nhuận ${money(p.loi_nhuan ?? 0)} ₫`,
            }))
            : [];

        const ticks = [0, 1, 2, 3, 4].map((k) => {
            const v = yMin + (span * k) / 4;
            return { y: y(v), label: compact(v) };
        });

        const step = Math.max(1, Math.ceil(n / 12));
        const xlabels = s
            .map((p, i) => ({ x: x(i), text: p.nhan, show: i % step === 0 }))
            .filter((l) => l.show);

        return { W, H, L, R, zeroY, bars, dots, line: dots.map((p) => `${p.x},${p.y}`).join(' '), ticks, xlabels };
    });

    constructor() {
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

    shiftYear(delta: number) {
        this.onYear(String(this.year() + delta));
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

        this.service.revenue(r.tu, r.den, r.nhom).subscribe({
            next: (d) => {
                if (id !== this.seq) return; // bỏ qua phản hồi cũ
                this.data.set(d);
                this.loading.set(false);
            },
            error: (e: HttpErrorResponse) => {
                if (id !== this.seq) return;
                this.loading.set(false);
                const errs = e.error?.errors as Record<string, string[]> | undefined;
                this.error.set(
                    errs ? Object.values(errs).flat().join(' ') : (e.error?.message ?? 'Không tải được báo cáo.'),
                );
            },
        });
    }

    percent(v: number): number {
        const total = this.data()?.tong_hop.doanh_thu ?? 0;
        return total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
    }

    toneClass(tone: Card['tone']): string {
        return {
            emerald: 'text-emerald-600',
            amber: 'text-amber-600',
            sky: 'text-sky-600',
            rose: 'text-red-600',
            slate: 'text-slate-800',
        }[tone];
    }

    private change(cur: number, prev: number): { text: string; up: boolean } | null {
        if (!prev) return cur > 0 ? { text: 'Mới phát sinh,', up: true } : null;
        const pct = ((cur - prev) / Math.abs(prev)) * 100;
        return {
            text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`,
            up: pct >= 0,
        };
    }
}
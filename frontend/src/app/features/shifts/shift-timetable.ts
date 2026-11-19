import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TimetableData, TimetableEntry } from './shift.model';
import { ShiftService } from './shift.service';
import { addDays, displayDate, formatDate, slotKey, timeShort, weekDays } from './week.util';

@Component({
  selector: 'app-shift-timetable',
  imports: [ButtonModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-calendar text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Thời khóa biểu làm việc</h1>
          @if (data(); as d) {
            <p class="text-sm text-slate-500">
              Tuần {{ show(d.tuan.tu_ngay) }} – {{ show(d.tuan.den_ngay) }}
              <span class="mx-1 text-slate-300">·</span>
              {{ total() }} lượt làm việc
              @if (d.tuan.la_tuan_dang_ky) {
                <span class="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  <i class="pi pi-clock text-[10px]"></i>
                  Đang mở đăng ký đến 23:59 thứ 7
                </span>
              }
            </p>
          }
        </div>
      </div>

      <div class="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/70 bg-white p-1 shadow-sm">
        <p-button label="Tuần trước" icon="pi pi-chevron-left" [text]="true" [disabled]="loading()" (onClick)="move(-1)" />
        <p-button label="Tuần này" [outlined]="true" [disabled]="loading()" (onClick)="thisWeek()" />
        <p-button label="Tuần sau" icon="pi pi-chevron-right" iconPos="right" [text]="true" [disabled]="loading()" (onClick)="move(1)" />
      </div>
    </div>

    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <i class="pi pi-exclamation-circle mt-0.5"></i>
        <span>{{ error() }}</span>
      </div>
    }

    @if (data(); as d) {
      <div class="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
        <table class="w-full min-w-[56rem] border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th class="w-32 p-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ca</th>
              @for (day of days(); track day.date) {
                <th
                  class="rounded-xl p-2 text-center font-semibold"
                  [class]="day.date === today ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 text-slate-700'"
                >
                  <div>{{ day.label }}</div>
                  <div class="text-xs font-normal" [class]="day.date === today ? 'text-emerald-50' : 'text-slate-500'">{{ day.short }}</div>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (ca of d.ca; track ca.MaCa) {
              <tr>
                <td class="p-2 align-top">
                  <div class="text-sm font-semibold text-slate-800">{{ ca.TenCa }}</div>
                  <div class="mt-0.5 text-xs tabular-nums text-slate-500">{{ time(ca.GioBatDau) }} – {{ time(ca.GioKetThuc) }}</div>
                </td>
                @for (day of days(); track day.date) {
                  <td class="p-0 align-top">
                    <div
                      class="min-h-24 rounded-xl border p-2 transition-colors"
                      [class]="day.date === today ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'"
                    >
                      @for (e of cell(day.date, ca.MaCa); track e.MaTaiKhoan) {
                        <div
                          class="mb-1 truncate rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100"
                          [title]="e.HoTen"
                        >
                          {{ e.HoTen }}
                        </div>
                      } @empty {
                        <span class="text-xs text-slate-300">—</span>
                      }
                      @if (cell(day.date, ca.MaCa).length > 0) {
                        <div class="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                          <i class="pi pi-users text-[10px]"></i>
                          {{ cell(day.date, ca.MaCa).length }} người
                        </div>
                      }
                    </div>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="p-8 text-center text-slate-500">Chưa có ca làm việc nào.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (summary().length) {
        <div class="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-users text-emerald-500"></i>
            Tổng số ca trong tuần
          </div>
          <div class="flex flex-wrap gap-2">
            @for (s of summary(); track $index) {
              <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <span class="font-medium text-slate-800">{{ s.name }}</span>
                <span class="text-slate-400">·</span>
                <span>{{ s.count }} ca</span>
              </span>
            }
          </div>
        </div>
      } @else if (!loading()) {
        <div class="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          <i class="pi pi-inbox text-slate-400"></i>
          Tuần này chưa có ai đăng ký ca làm việc.
        </div>
      }
    } @else if (loading()) {
      <div class="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
        <i class="pi pi-spin pi-spinner text-emerald-500"></i>
        Đang tải...
      </div>
    }
  `,
})
export class ShiftTimetable {
  private service = inject(ShiftService);

  readonly show = displayDate;
  readonly time = timeShort;
  readonly today = formatDate(new Date());

  readonly data = signal<TimetableData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private from: string | undefined; // undefined = tuần hiện tại

  readonly days = computed(() => {
    const d = this.data();
    return d?.tuan ? weekDays(d.tuan.tu_ngay) : [];
  });

  readonly total = computed(() => this.data()?.data.length ?? 0);

  readonly grid = computed(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const e of this.data()?.data ?? []) {
      const k = slotKey(String(e.Ngay).slice(0, 10), Number(e.MaCa));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  });

  readonly summary = computed(() => {
    const byUser = new Map<number, { name: string; count: number }>();
    for (const e of this.data()?.data ?? []) {
      const cur = byUser.get(e.MaTaiKhoan) ?? { name: e.HoTen, count: 0 };
      cur.count++;
      byUser.set(e.MaTaiKhoan, cur);
    }
    return [...byUser.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'),
    );
  });

  constructor() {
    this.load();
  }

  cell(date: string, ca: number): TimetableEntry[] {
    return this.grid().get(slotKey(date, ca)) ?? [];
  }

  move(weeks: number) {
    const d = this.data();
    if (!d?.tuan) return;
    this.from = addDays(d.tuan.tu_ngay, weeks * 7);
    this.load();
  }

  thisWeek() {
    this.from = undefined;
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.service.timetable(this.from).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Không tải được thời khóa biểu.');
      },
    });
  }
}
import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { RegisterData } from './shift.model';
import { ShiftService } from './shift.service';
import { addDays, displayDate, slotKey, timeShort, weekDays } from './week.util';

@Component({
    selector: 'app-shift-register',
    imports: [ButtonModule],
    template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-slate-800">Đăng ký lịch làm việc</h1>
        @if (data(); as d) {
          <p class="text-sm text-slate-500">
            Tuần sau: {{ show(d.tuan.tu_ngay) }} – {{ show(d.tuan.den_ngay) }}
          </p>
        }
      </div>

      @if (open()) {
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-600">Đã chọn <b>{{ selected().size }}</b> ca</span>
          <p-button
            label="Lưu đăng ký"
            icon="pi pi-check"
            [loading]="busy()"
            [disabled]="!dirty() || busy()"
            (onClick)="save()"
          />
        </div>
      }
    </div>

    @if (data(); as d) {
      @if (open()) {
        <div class="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          Đang mở đăng ký cho tuần sau. Hạn đăng ký: <b>23:59 thứ 7, {{ deadline() }}</b>.
          Lịch bắt đầu áp dụng từ <b>thứ 2, {{ show(d.tuan.tu_ngay) }}</b>. Bạn có thể sửa hoặc hủy đến hết hạn.
        </div>
      } @else {
        <div class="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Đã hết hạn đăng ký cho tuần {{ show(d.tuan.tu_ngay) }} – {{ show(d.tuan.den_ngay) }}
          (hạn là 23:59 thứ 7, {{ deadline() }}). Bạn chỉ có thể xem lịch đã đăng ký.
        </div>
      }
    }

    @if (success()) {
      <div class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
    }
    @if (error()) {
      <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
    }

    @if (data(); as d) {
      @if (d.ca.length === 0) {
        <div class="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
          Chưa có ca làm việc nào. Hãy chạy seeder ca làm việc hoặc liên hệ quản lý.
        </div>
      } @else {
        <div class="overflow-x-auto rounded-xl bg-white p-3 shadow-sm">
          <table class="w-full min-w-[44rem] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th class="w-36 p-2 text-left font-medium text-slate-500">Ca</th>
                @for (day of days(); track day.date) {
                  <th class="p-2 text-center font-medium text-slate-700">
                    <div>{{ day.label }}</div>
                    <div class="text-xs font-normal text-slate-500">{{ day.short }}</div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (ca of d.ca; track ca.MaCa) {
                <tr>
                  <td class="p-2">
                    <div class="font-medium text-slate-800">{{ ca.TenCa }}</div>
                    <div class="text-xs text-slate-500">{{ time(ca.GioBatDau) }} – {{ time(ca.GioKetThuc) }}</div>
                  </td>
                  @for (day of days(); track day.date) {
                    <td class="p-0">
                      <button
                        type="button"
                        [class]="cellClass(day.date, ca.MaCa)"
                        [disabled]="!open() || busy()"
                        [attr.aria-pressed]="has(day.date, ca.MaCa)"
                        (click)="toggle(day.date, ca.MaCa)"
                      >
                        @if (has(day.date, ca.MaCa)) {
                          <i class="pi pi-check"></i>
                        }
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="mt-3 text-xs text-slate-500">
          Bấm vào ô để chọn hoặc bỏ chọn ca. Nhớ bấm "Lưu đăng ký" để lưu thay đổi.
        </p>
      }
    } @else if (loading()) {
      <p class="text-slate-500">Đang tải...</p>
    }
  `,
})
export class ShiftRegister {
    private service = inject(ShiftService);

    readonly show = displayDate;
    readonly time = timeShort;

    readonly data = signal<RegisterData | null>(null);
    readonly selected = signal<Set<string>>(new Set());
    readonly original = signal<Set<string>>(new Set());
    readonly loading = signal(true);
    readonly busy = signal(false);
    readonly error = signal<string | null>(null);
    readonly success = signal<string | null>(null);

    readonly open = computed(() => !!this.data()?.tuan?.dang_mo);

    readonly days = computed(() => {
        const d = this.data();
        return d?.tuan ? weekDays(d.tuan.tu_ngay) : [];
    });

    readonly deadline = computed(() => {
        const d = this.data();
        return d?.tuan ? displayDate(addDays(d.tuan.tu_ngay, -2)) : '';
    });

    readonly dirty = computed(() => {
        const a = this.selected();
        const b = this.original();
        return a.size !== b.size || [...a].some((k) => !b.has(k));
    });

    constructor() {
        this.load();
    }

    load() {
        this.loading.set(true);
        this.error.set(null);
        this.service.registration().subscribe({
            next: (d) => {
                this.data.set(d);
                const set = new Set(d.da_chon.map((s) => slotKey(s.Ngay, s.MaCa)));
                this.selected.set(new Set(set));
                this.original.set(set);
                this.loading.set(false);
            },
            error: (e: HttpErrorResponse) => {
                this.loading.set(false);
                this.error.set(e.error?.message ?? 'Không tải được dữ liệu đăng ký ca.');
            },
        });
    }

    has(date: string, ca: number) {
        return this.selected().has(slotKey(date, ca));
    }

    toggle(date: string, ca: number) {
        if (!this.open() || this.busy()) return;
        const k = slotKey(date, ca);
        this.selected.update((s) => {
            const next = new Set(s);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    }

    cellClass(date: string, ca: number): string {
        const base = 'flex h-12 w-full items-center justify-center rounded-lg border text-lg transition ';
        if (this.has(date, ca)) {
            return base + 'border-emerald-600 bg-emerald-600 text-white';
        }
        return (
            base +
            (this.open()
                ? 'border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50'
                : 'border-slate-100 bg-slate-50')
        );
    }

    save() {
        if (!this.dirty() || !this.open()) return;

        const slots = [...this.selected()].map((k) => {
            const [Ngay, ca] = k.split('|');
            return { Ngay, MaCa: Number(ca) };
        });

        this.busy.set(true);
        this.error.set(null);
        this.service.saveRegistration(slots).subscribe({
            next: (res) => {
                this.busy.set(false);
                this.original.set(new Set(this.selected()));
                this.success.set(res.message);
                setTimeout(() => this.success.set(null), 4000);
            },
            error: (e: HttpErrorResponse) => {
                this.busy.set(false);
                const errs = e.error?.errors as Record<string, string[]> | undefined;
                this.error.set(
                    errs ? Object.values(errs).flat().join(' ') : (e.error?.message ?? 'Lưu đăng ký thất bại.'),
                );
            },
        });
    }
}
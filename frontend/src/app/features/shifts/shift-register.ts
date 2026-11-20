import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { RegisterData, SlotInfo } from './shift.model';
import { ShiftService } from './shift.service';
import { addDays, displayDate, slotKey, timeShort, weekDays } from './week.util';

@Component({
  selector: 'app-shift-register',
  imports: [ButtonModule],
  template: `
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-calendar-plus text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Đăng ký lịch làm việc</h1>
          @if (data(); as d) {
            <p class="text-sm text-slate-500">
              Tuần sau: {{ show(d.tuan.tu_ngay) }} – {{ show(d.tuan.den_ngay) }}
            </p>
          }
        </div>
      </div>

      @if (open()) {
        <div class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm">
          <span class="text-sm text-slate-600">
            Đã chọn <b class="text-emerald-700">{{ selected().size }}</b> ca
          </span>
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
        <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <i class="pi pi-check-circle mt-0.5"></i>
          <span>
            Đang mở đăng ký cho tuần sau. Hạn đăng ký: <b>23:59 thứ 7, {{ deadline() }}</b>.
            Lịch bắt đầu áp dụng từ <b>thứ 2, {{ show(d.tuan.tu_ngay) }}</b>. Bạn có thể sửa hoặc hủy đến hết hạn.
          </span>
        </div>
      } @else {
        <div class="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <i class="pi pi-lock mt-0.5"></i>
          <span>
            Đã hết hạn đăng ký cho tuần {{ show(d.tuan.tu_ngay) }} – {{ show(d.tuan.den_ngay) }}
            (hạn là 23:59 thứ 7, {{ deadline() }}). Bạn chỉ có thể xem lịch đã đăng ký.
          </span>
        </div>
      }
    }

    @if (success()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5"></i>
        <span>{{ success() }}</span>
      </div>
    }
    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <i class="pi pi-exclamation-circle mt-0.5"></i>
        <span>{{ error() }}</span>
      </div>
    }

    @if (data(); as d) {
      @if (d.ca.length === 0) {
        <div class="rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
          <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <i class="pi pi-inbox text-xl"></i>
          </div>
          <p class="text-sm text-slate-500">Chưa có ca làm việc nào. Hãy chạy seeder ca làm việc hoặc liên hệ quản lý.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
          <table class="w-full min-w-[44rem] border-separate border-spacing-1.5 text-sm">
            <thead>
              <tr>
                <th class="w-36 p-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ca</th>
                @for (day of days(); track day.date) {
                  <th class="rounded-xl bg-slate-50/80 p-2 text-center font-semibold text-slate-700">
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
                    <div class="text-sm font-semibold text-slate-800">{{ ca.TenCa }}</div>
                    <div class="mt-0.5 text-xs tabular-nums text-slate-500">{{ time(ca.GioBatDau) }} – {{ time(ca.GioKetThuc) }}</div>
                  </td>
                  @for (day of days(); track day.date) {
                    <td class="p-0">
                      <button
                        type="button"
                        [class]="cellClass(day.date, ca.MaCa)"
                        [disabled]="!open() || busy() || blocked(day.date, ca.MaCa)"
                        [attr.aria-pressed]="has(day.date, ca.MaCa)"
                        [attr.title]="cellTitle(day.date, ca.MaCa)"
                        (click)="toggle(day.date, ca.MaCa)"
                      >
                        @if (has(day.date, ca.MaCa)) {
                          <i class="pi pi-check"></i>
                        }
                        @if (slotInfo(day.date, ca.MaCa); as info) {
                          <span
                            class="flex items-center gap-0.5 text-[10px] font-medium leading-none tabular-nums"
                            [class]="has(day.date, ca.MaCa) ? 'text-white/80' : 'text-slate-400'"
                          >
                            {{ info.so_nhan_vien }}/{{ maxStaff() }}
                            @if (info.so_quan_ly > 0) {
                              <i class="pi pi-shield text-[8px]"></i>
                            }
                          </span>
                        }
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <i class="pi pi-info-circle mt-0.5 text-emerald-500"></i>
          <span>
            Bấm vào ô để chọn hoặc bỏ chọn ca. Mỗi ca tối đa <b class="text-slate-700">2 nhân viên</b>;
            quản lý/chủ có thể đăng ký chung ca với nhân viên (tổng tối đa 3 người) và mỗi ca chỉ một quản lý.
            Số <b class="text-slate-700">x/{{ maxStaff() }}</b> trên ô là số nhân viên đã đăng ký. Nhớ bấm "Lưu đăng ký" để lưu thay đổi.
          </span>
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

  readonly maxStaff = computed(() => this.data()?.gioi_han?.nhan_vien ?? 2);

  private readonly slotMap = computed(() => {
    const map = new Map<string, SlotInfo>();
    for (const s of this.data()?.da_ky ?? []) {
      map.set(slotKey(String(s.Ngay).slice(0, 10), Number(s.MaCa)), s);
    }
    return map;
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

  slotInfo(date: string, ca: number) {
    return this.slotMap().get(slotKey(date, ca));
  }

  blocked(date: string, ca: number) {
    return !this.has(date, ca) && this.slotInfo(date, ca)?.con_cho === false;
  }

  cellTitle(date: string, ca: number): string {
    if (!this.open()) return '';
    if (this.blocked(date, ca)) return 'Ca đã đủ người đăng ký';
    const info = this.slotInfo(date, ca);
    return info
      ? `Đã đăng ký ${info.so_nhan_vien}/${this.maxStaff()} nhân viên`
      : `Còn trống ${this.maxStaff()}/${this.maxStaff()} nhân viên`;
  }

  toggle(date: string, ca: number) {
    if (!this.open() || this.busy() || this.blocked(date, ca)) return;
    const k = slotKey(date, ca);
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  cellClass(date: string, ca: number): string {
    const base = 'flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border text-lg transition ';
    if (this.has(date, ca)) {
      return base + 'border-emerald-600 bg-emerald-600 text-white shadow-sm';
    }
    if (this.blocked(date, ca)) {
      return base + 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300';
    }
    return (
      base +
      (this.open()
        ? 'border-slate-200 bg-slate-50 text-slate-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600'
        : 'border-slate-100 bg-slate-50 text-slate-200')
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
        this.load(); // tải lại số chỗ đã đăng ký của từng ca
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
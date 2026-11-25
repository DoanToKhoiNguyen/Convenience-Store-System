import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, of, startWith } from 'rxjs';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE } from '../../core/auth/roles';
import { ConfirmService } from '../../core/ui/confirm.service';
import { plainEnter } from '../../core/ui/enter';
import { Product, ProductPayload, Supplier } from './product.model';
import { ProductService } from './product.service';
import { Category } from '../categories/category.model';
import { CategoryService } from '../categories/category.service';
import { Lot, lotSeverity, lotText } from '../lots/lot.model';
import { LotService } from '../lots/lot.service';

type HsdFilter = 'all' | 'sap_het_han' | 'het_han';

// Bỏ dấu để gõ "nuoc ngot" vẫn tìm ra "Nước ngọt"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const num = (v: number | null | undefined) => (v == null ? null : Number(v));
const text = (v: string | null | undefined) => (v ?? '').trim() || null;

const OTHER = 'Khác';
const categoryOf = (p: Product) => p.LoaiSanPham?.trim() || OTHER;

@Component({
  selector: 'app-product-list',
  imports: [
    ReactiveFormsModule, RouterLink, TableModule, TagModule, ButtonModule,
    DialogModule, InputTextModule, TooltipModule, DecimalPipe, DatePipe,
  ],
  template: `
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <i class="pi pi-box text-lg"></i>
        </span>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-800">Sản phẩm</h1>
          <p class="text-sm text-slate-500">{{ filtered().length }} / {{ products().length }} sản phẩm</p>
        </div>
      </div>

      <div class="flex w-full flex-wrap items-center gap-3 sm:w-auto">
        <div class="relative w-full sm:w-80">
          <input
            pInputText
            type="search"
            placeholder="Tìm theo tên hoặc mã lô..."
            class="w-full"
            [value]="keyword()"
            (input)="onSearch($any($event.target).value)"
          />
        </div>
        @if (canEdit()) {
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700 hover:shadow-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98]"
            (click)="openCreate()"
          >
            <i class="pi pi-plus text-xs"></i>
            Thêm sản phẩm
          </button>
        }
      </div>
    </div>

    <!-- Lọc theo danh mục -->
    @if (categoryChips().length > 1) {
      <div class="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition"
          [class]="category() === null
            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'"
          (click)="onCategory(null)"
        >
          Tất cả ({{ base().length }})
        </button>
        @for (c of categoryChips(); track c.name) {
          <button
            type="button"
            class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition"
            [class]="category() === c.name
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'"
            (click)="onCategory(c.name)"
          >
            {{ c.name }} ({{ c.count }})
          </button>
        }
      </div>
    }

    <!-- Lọc theo hạn sử dụng -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-slate-500">Hạn dùng:</span>
      <div class="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          [class]="hsdFilter() === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'"
          (click)="onHsd('all')"
        >
          Tất cả
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          [class]="hsdFilter() === 'sap_het_han' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'"
          (click)="onHsd('sap_het_han')"
        >
          Sắp hết hạn ({{ hsdCounts().sap }})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          [class]="hsdFilter() === 'het_han' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'"
          (click)="onHsd('het_han')"
        >
          Đã hết hạn ({{ hsdCounts().het }})
        </button>
      </div>

      @if (hasFilter()) {
        <button
          type="button"
          class="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          (click)="clearFilters()"
        >
          <i class="pi pi-filter-slash text-xs"></i> Xóa bộ lọc
        </button>
      }
    </div>

    @if (success()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <i class="pi pi-check-circle mt-0.5 text-emerald-500"></i>
        <span>{{ success() }}</span>
      </div>
    }
    @if (error()) {
      <div class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
        <span>{{ error() }}</span>
      </div>
    }

    <div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <i class="pi pi-list text-emerald-500"></i>
          Danh sách sản phẩm
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {{ filtered().length }} sản phẩm
        </span>
      </div>

      <p-table
        [value]="filtered()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        [first]="first()"
        (onPage)="onPage($event)"
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="MaSanPham"
        [expandedRowKeys]="expanded()"
        [tableStyle]="{ 'min-width': '48rem' }"
        styleClass="text-sm"
      >
        <ng-template #header>
          <tr class="bg-slate-50/80">
            <th>Tên sản phẩm</th>
            <th>Loại</th>
            @if (canEdit()) {
              <th class="text-right!">Giá nhập</th>
            }
            <th class="text-right!">Giá bán</th>
            <th class="text-right!">Tồn kho</th>
            <th>Hạn dùng</th>
            <th>Trạng thái</th>
            @if (canEdit()) {
              <th class="text-right!">Thao tác</th>
            }
          </tr>
        </ng-template>

        <ng-template #body let-p>
          <tr class="transition-colors hover:bg-emerald-100/60!">
            <td>
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60">
                  @if (p.hinh_anh_url) {
                    <img [src]="p.hinh_anh_url" alt="" class="h-full w-full object-cover" />
                  } @else {
                    <i class="pi pi-image text-slate-300"></i>
                  }
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-800">{{ p.TenSanPham }}</div>
                  @if (p.TenThuongHieu) {
                    <div class="truncate text-xs text-slate-500">{{ p.TenThuongHieu }}</div>
                  }
                </div>
              </div>
            </td>

            <td>
              @if (p.LoaiSanPham) {
                <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {{ p.LoaiSanPham }}
                </span>
              } @else {
                <span class="text-slate-400">—</span>
              }
            </td>

            @if (canEdit()) {
              <td class="text-right! tabular-nums text-slate-600">{{ p.DonGiaNhap | number: '1.0-0' }}</td>
            }
            <td class="text-right! font-medium tabular-nums text-slate-800">{{ p.DonGiaBan | number: '1.0-0' }}</td>
            <td class="text-right! tabular-nums">{{ p.SoLuongHienTai }}</td>

            <td>
              @if (p.han_gan_nhat) {
                <div class="flex flex-col items-start gap-1">
                  <p-tag [value]="hsdText(p)" [severity]="hsdSeverity(p)" />
                  <span class="text-xs text-slate-500">{{ p.han_gan_nhat | date: 'dd/MM/yyyy' }}</span>
                </div>
              } @else {
                <span class="text-xs text-slate-400">Không có hạn</span>
              }
              @if ((p.so_luong_het_han ?? 0) > 0) {
                <div class="mt-1 flex items-center gap-1 text-xs text-red-600">
                  <i class="pi pi-exclamation-triangle text-[10px]"></i>
                  {{ p.so_luong_het_han }} sản phẩm đã hết hạn
                </div>
              }
              <button
                type="button"
                class="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-700"
                (click)="toggleLots(p)"
              >
                <i class="pi pi-chevron-right text-[9px] transition-transform" [class.rotate-90]="expanded()[p.MaSanPham]"></i>
                {{ expanded()[p.MaSanPham] ? 'Ẩn các lô' : 'Xem ' + (p.lo_hang?.length ?? 0) + ' lô' }}
              </button>
            </td>

            <td><p-tag [value]="stock(p).label" [severity]="stock(p).severity" /></td>

            @if (canEdit()) {
              <td class="text-right!">
                <div class="flex justify-end gap-0.5">
                  <p-button
                    icon="pi pi-pencil"
                    ariaLabel="Sửa sản phẩm"
                    pTooltip="Sửa sản phẩm"
                    tooltipPosition="top"
                    size="small"
                    [text]="true"
                    [rounded]="true"
                    (onClick)="openEdit(p)"
                  />
                  @if (isHidden(p)) {
                    <p-button
                      icon="pi pi-eye"
                      ariaLabel="Hiện lại sản phẩm"
                      pTooltip="Hiện lại sản phẩm"
                      tooltipPosition="top"
                      size="small"
                      severity="success"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="busy()"
                      (onClick)="restore(p)"
                    />
                  } @else {
                    <p-button
                      icon="pi pi-trash"
                      ariaLabel="Xóa sản phẩm"
                      pTooltip="Xóa sản phẩm"
                      tooltipPosition="top"
                      size="small"
                      severity="danger"
                      [text]="true"
                      [rounded]="true"
                      [disabled]="busy()"
                      (onClick)="remove(p)"
                    />
                  }
                </div>
              </td>
            }
          </tr>
        </ng-template>

        <ng-template #expandedrow let-p>
          <tr>
            <td [attr.colspan]="canEdit() ? 8 : 6" class="bg-slate-50/80 px-4 py-4 sm:px-6">
              <div class="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                <i class="pi pi-box text-xs text-slate-400"></i>
                Các lô còn hàng của {{ p.TenSanPham }}
                @if (p.TienToLo) {
                  <span class="font-normal text-slate-400">· tiền tố {{ p.TienToLo }}</span>
                }
              </div>

              @if (p.lo_hang?.length) {
                <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table class="w-full max-w-3xl text-sm">
                    <thead>
                      <tr class="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                        <th class="px-3 py-2 text-left font-semibold">Mã lô</th>
                        <th class="px-3 py-2 text-left font-semibold">Ngày nhập</th>
                        <th class="px-3 py-2 text-left font-semibold">Hạn sử dụng</th>
                        <th class="px-3 py-2 text-right font-semibold">Còn lại / Nhập</th>
                        <th class="px-3 py-2 pl-4 text-left font-semibold">Tình trạng</th>
                        @if (canEdit()) {
                          <th class="px-3 py-2"></th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (l of p.lo_hang; track l.MaLoHang) {
                        <tr class="transition-colors hover:bg-emerald-50/70">
                          <td class="px-3 py-2 font-medium text-slate-800">{{ l.MaLo }}</td>
                          <td class="px-3 py-2 text-slate-600">{{ l.NgayNhap | date: 'dd/MM/yyyy' }}</td>
                          <td class="px-3 py-2 text-slate-600">{{ l.HanSuDung ? (l.HanSuDung | date: 'dd/MM/yyyy') : '—' }}</td>
                          <td class="px-3 py-2 text-right tabular-nums">{{ l.SoLuongCon }} / {{ l.SoLuongNhap }}</td>
                          <td class="px-3 py-2 pl-4"><p-tag [value]="lotText(l)" [severity]="lotSeverity(l.trang_thai)" /></td>
                          @if (canEdit()) {
                            <td class="px-3 py-2 text-right">
                              <p-button
                                icon="pi pi-calendar"
                                ariaLabel="Đặt hạn sử dụng"
                                pTooltip="Đặt hạn sử dụng"
                                tooltipPosition="top"
                                size="small"
                                [text]="true"
                                [rounded]="true"
                                (onClick)="openLotExpiry(l)"
                              />
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-slate-500">Chưa có lô nào còn hàng.</p>
              }
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td [attr.colspan]="canEdit() ? 8 : 6" class="px-4 py-14 text-center!">
              <div class="flex flex-col items-center gap-3 text-slate-500">
                <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <i class="pi pi-inbox text-xl"></i>
                </span>
                <span class="text-sm">Không có sản phẩm nào phù hợp.</span>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Thêm / sửa sản phẩm -->
    <p-dialog
      [header]="editing() ? 'Sửa sản phẩm' : 'Thêm sản phẩm'"
      [modal]="true"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      (keydown.enter)="onEnter($event)"
      [style]="{ width: '42rem', maxWidth: '95vw' }"
    >
      <form [formGroup]="form" class="space-y-4">
        @if (formError()) {
          <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-info-circle text-emerald-500"></i>
            Thông tin cơ bản
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
            <input pInputText formControlName="TenSanPham" class="w-full" />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Danh mục *</label>
              <select
                formControlName="MaDanhMuc"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option [ngValue]="null" disabled>-- Chọn danh mục --</option>
                @for (c of categories(); track c.MaDanhMuc) {
                  <option [ngValue]="c.MaDanhMuc">{{ c.TenDanhMuc }}</option>
                }
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Thương hiệu</label>
              <input pInputText formControlName="TenThuongHieu" class="w-full" />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Nhà cung cấp *</label>
            <select
              formControlName="MaNhaCungCap"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
              [attr.disabled]="formCategory() == null ? '' : null"
            >
              <option [ngValue]="null" disabled>
                {{ formCategory() == null ? '-- Chọn danh mục trước --' : '-- Chọn nhà cung cấp --' }}
              </option>
              @for (s of supplierOptions(); track s.MaNhaCungCap) {
                <option [ngValue]="s.MaNhaCungCap">{{ s.TenNhaCungCap }}</option>
              }
            </select>
            @if (formCategory() != null && supplierOptions().length === 0) {
              <small class="mt-1 flex items-start gap-1.5 text-amber-700">
                <i class="pi pi-exclamation-triangle mt-px text-xs"></i>
                <span>
                  Chưa có nhà cung cấp nào cung cấp danh mục này. Hãy thêm hoặc cập nhật ở trang
                  <a routerLink="/admin/suppliers" class="underline">Nhà cung cấp</a>.
                </span>
              </small>
            }
          </div>
        </div>

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-tag text-emerald-500"></i>
            Giá bán
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Giá nhập *</label>
              <input pInputText type="number" min="0" formControlName="DonGiaNhap" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Giá bán *</label>
              <input pInputText type="number" min="0" formControlName="DonGiaBan" class="w-full" />
            </div>
          </div>
        </div>

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-sliders-h text-emerald-500"></i>
            Tồn kho &amp; cảnh báo
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Tồn tối thiểu *</label>
              <input pInputText type="number" min="0" formControlName="TonKhoToiThieu" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Tồn tối đa</label>
              <input pInputText type="number" min="0" formControlName="TonKhoToiDa" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Cảnh báo HSD (ngày)</label>
              <input pInputText type="number" min="0" formControlName="CanhBaoHSD" class="w-full" />
            </div>
          </div>
          @if (form.hasError('maxLtMin')) {
            <small class="flex items-center gap-1.5 text-red-600">
              <i class="pi pi-exclamation-circle text-xs"></i>
              Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.
            </small>
          }
        </div>

        @if (editing(); as e) {
          <div class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <i class="pi pi-info-circle mt-0.5 text-slate-400"></i>
            <span>
              Tồn kho hiện tại: <b class="text-slate-800">{{ e.SoLuongHienTai }}</b>. Muốn đổi số lượng, dùng trang "Cập nhật tồn kho" để có lịch sử.
            </span>
          </div>
        } @else {
          <div class="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <i class="pi pi-info-circle mt-0.5 text-emerald-500"></i>
            <span>
              Sản phẩm mới có tồn kho 0. Số lượng và hạn sử dụng được nhập khi nhập hàng
              (Cảnh báo kho → Lập phiếu nhập → Nhận hàng). Mã lô do hệ thống tự tạo.
            </span>
          </div>
        }

        <div class="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="pi pi-image text-emerald-500"></i>
            Ảnh &amp; mô tả
          </div>

          <div class="flex items-start gap-4">
            <label
              class="group relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white transition hover:border-emerald-500 hover:bg-emerald-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200"
              title="Bấm để chọn ảnh"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="sr-only"
                (change)="onFile($event)"
              />

              @if (imagePreview()) {
                <img [src]="imagePreview()" alt="Ảnh sản phẩm" class="h-full w-full object-cover" />
                <span class="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                  Bấm để đổi ảnh
                </span>
              } @else {
                <span class="flex flex-col items-center gap-1 px-2 text-center text-slate-400 group-hover:text-emerald-600">
                  <i class="pi pi-image text-2xl"></i>
                  <span class="text-[11px] font-medium">Bấm để chọn ảnh</span>
                </span>
              }
            </label>

            <div class="space-y-1.5 pt-1 text-xs text-slate-500">
              <p>JPG, PNG hoặc WebP, tối đa 2 MB.</p>
              @if (imagePreview()) {
                <button type="button" class="inline-flex items-center gap-1 font-medium text-red-600 hover:underline" (click)="clearImage()">
                  <i class="pi pi-trash text-[10px]"></i> Xóa ảnh
                </button>
              }
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</label>
            <textarea
              formControlName="MoTa"
              rows="2"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            ></textarea>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Thành phần</label>
            <textarea
              formControlName="ThanhPhan"
              rows="2"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            ></textarea>
          </div>
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="busy()" (onClick)="dialogOpen.set(false)" />
        <p-button
          label="Lưu"
          icon="pi pi-check"
          [loading]="busy()"
          [disabled]="form.invalid || busy()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>

    <!-- Đặt hạn sử dụng cho lô -->
    <p-dialog
      header="Hạn sử dụng của lô"
      [modal]="true"
      [visible]="!!lotTarget()"
      (visibleChange)="!$event && lotTarget.set(null)"
      (keydown.enter)="onLotEnter($event)"
      [style]="{ width: '24rem', maxWidth: '92vw' }"
    >
      @if (lotTarget(); as l) {
        <div class="space-y-3">
          @if (lotError()) {
            <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
              <span>{{ lotError() }}</span>
            </div>
          }
          <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <i class="pi pi-box text-slate-400"></i>
            <span>Lô <b class="text-slate-800">{{ l.MaLo }}</b> · còn {{ l.SoLuongCon }}</span>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Hạn sử dụng</label>
            <input
              type="date"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              [value]="lotDate()"
              (input)="lotDate.set($any($event.target).value)"
            />
            <small class="mt-1 block text-slate-500">Để trống nếu hàng không có hạn sử dụng.</small>
          </div>
        </div>
      }
      <ng-template #footer>
        <p-button label="Hủy" [text]="true" [disabled]="lotBusy()" (onClick)="lotTarget.set(null)" />
        <p-button label="Lưu" icon="pi pi-check" [loading]="lotBusy()" [disabled]="lotBusy()" (onClick)="saveLotExpiry()" />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductList {
  private service = inject(ProductService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private lotService = inject(LotService);
  private confirmDialog = inject(ConfirmService);

  readonly lotText = lotText;
  readonly lotSeverity = lotSeverity;

  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly keyword = signal('');
  readonly category = signal<string | null>(null);
  readonly hsdFilter = signal<HsdFilter>('all');
  readonly first = signal(0);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly formError = signal<string | null>(null);

  readonly expanded = signal<Record<string, boolean>>({});

  readonly lotTarget = signal<Lot | null>(null);
  readonly lotDate = signal('');
  readonly lotBusy = signal(false);
  readonly lotError = signal<string | null>(null);

  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly imageRemoved = signal(false);

  // Chỉ chủ và quản lý được thêm / sửa (khớp route role:1,2 ở backend)
  readonly canEdit = computed(() => this.auth.hasAnyRole([ROLE.OWNER, ROLE.MANAGER]));

  readonly form = this.fb.group(
    {
      TenSanPham: ['', Validators.required],
      MaDanhMuc: [null as number | null, Validators.required],
      TenThuongHieu: [''],
      MaNhaCungCap: [null as number | null, Validators.required],
      DonGiaNhap: [null as number | null, [Validators.required, Validators.min(0)]],
      DonGiaBan: [null as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiThieu: [0 as number | null, [Validators.required, Validators.min(0)]],
      TonKhoToiDa: [null as number | null],
      CanhBaoHSD: [null as number | null],
      MoTa: [''],
      ThanhPhan: [''],
    },
    {
      validators: (g) => {
        const min = g.get('TonKhoToiThieu')?.value;
        const max = g.get('TonKhoToiDa')?.value;
        return max != null && min != null && Number(max) < Number(min) ? { maxLtMin: true } : null;
      },
    },
  );

  // Danh mục đang chọn trong form (dạng signal để lọc nhà cung cấp theo danh mục)
  readonly formCategory = toSignal(
    this.form.controls.MaDanhMuc.valueChanges.pipe(startWith(this.form.controls.MaDanhMuc.value)),
    { requireSync: true },
  );

  // Chỉ hiện nhà cung cấp đang hợp tác và cung cấp danh mục đã chọn.
  // Khi sửa mà chưa đổi danh mục thì vẫn giữ nhà cung cấp hiện tại của sản phẩm.
  readonly supplierOptions = computed(() => {
    const cat = this.formCategory();
    if (cat == null) return [];

    const e = this.editing();
    const keepId = e && Number(e.MaDanhMuc) === Number(cat) ? Number(e.MaNhaCungCap ?? 0) : 0;

    return this.suppliers().filter(
      (s) =>
        s.MaNhaCungCap === keepId ||
        (Number(s.TrangThai ?? 1) === 1 && (s.DanhMucIds ?? []).includes(Number(cat))),
    );
  });

  // Đã lọc theo từ khóa và hạn dùng, chưa lọc theo danh mục (để đếm số lượng mỗi danh mục)
  readonly base = computed(() => {
    const words = normalize(this.keyword().trim()).split(/\s+/).filter(Boolean);
    const f = this.hsdFilter();

    return this.products().filter((p) => {
      if (f !== 'all' && p.trang_thai_hsd !== f) return false;
      if (words.length === 0) return true;
      if (this.khopMaLo(p)) return true;
      const ten = this.tuTen(p);
      return words.every((w) => ten.some((t) => t.startsWith(w)));
    });
  });

  readonly categoryChips = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.products()) counts.set(categoryOf(p), 0);
    for (const p of this.base()) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1);

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name.localeCompare(b.name, 'vi'),
      );
  });

  readonly filtered = computed(() => {
    const cat = this.category();
    return this.base().filter((p) => !cat || categoryOf(p) === cat);
  });

  readonly hasFilter = computed(
    () => this.keyword().trim() !== '' || this.category() !== null || this.hsdFilter() !== 'all',
  );

  readonly hsdCounts = computed(() => ({
    sap: this.products().filter((p) => p.trang_thai_hsd === 'sap_het_han').length,
    het: this.products().filter((p) => p.trang_thai_hsd === 'het_han').length,
  }));

  constructor() {
    this.load();

    // Đổi danh mục thì bỏ nhà cung cấp đã chọn nếu nó không còn nằm trong danh sách hợp lệ
    this.form.controls.MaDanhMuc.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const supplier = this.form.controls.MaNhaCungCap;
      const id = supplier.value;
      if (id != null && !this.supplierOptions().some((s) => s.MaNhaCungCap === id)) {
        supplier.setValue(null, { emitEvent: false });
      }
    });

    if (this.canEdit()) {
      this.service.suppliers().subscribe({
        next: (s) => this.suppliers.set(s ?? []),
        error: () => this.error.set('Không tải được danh sách nhà cung cấp.'),
      });
      this.categoryService.list().subscribe({
        next: (c) => this.categories.set(c ?? []),
        error: () => this.error.set('Không tải được danh sách danh mục.'),
      });
    }
  }

  // ---------- Dữ liệu và bộ lọc ----------

  load() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  // Tách tên sản phẩm thành từng "từ" (bỏ dấu, viết thường) để so khớp theo đầu từ.
  // Không dò thương hiệu hay mã sản phẩm.
  private tuTen(p: Product): string[] {
    return normalize(p.TenSanPham ?? '')
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  // Khớp mã lô: mã lô bắt đầu bằng từ khóa (gõ "BQC" hay "BQC-001" đều ra)
  private khopMaLo(p: Product): boolean {
    const q = normalize(this.keyword().trim());
    return q !== '' && (p.lo_hang ?? []).some((l) => normalize(l.MaLo ?? '').startsWith(q));
  }

  onSearch(v: string) {
    this.keyword.set(v);
    this.first.set(0);
  }

  onCategory(name: string | null) {
    this.category.set(name);
    this.first.set(0);
  }

  onHsd(f: HsdFilter) {
    this.hsdFilter.set(f);
    this.first.set(0);
  }

  clearFilters() {
    this.keyword.set('');
    this.category.set(null);
    this.hsdFilter.set('all');
    this.first.set(0);
  }

  onPage(e: TablePageEvent) {
    this.first.set(e.first);
  }

  isHidden(p: Product) {
    return Number(p.TrangThai ?? 1) === 0;
  }

  stock(p: Product): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
    if (this.isHidden(p)) return { label: 'Đã ẩn', severity: 'secondary' };
    if (p.SoLuongHienTai <= 0) return { label: 'Hết hàng', severity: 'danger' };
    if (p.SoLuongHienTai <= p.TonKhoToiThieu) return { label: 'Sắp hết', severity: 'warn' };
    return { label: 'Còn hàng', severity: 'success' };
  }

  // ---------- Hạn sử dụng và lô ----------

  hsdText(p: Product): string {
    return lotText({ trang_thai: p.trang_thai_hsd ?? 'khong_han', so_ngay_con_lai: p.so_ngay_hsd ?? null });
  }

  hsdSeverity(p: Product) {
    return lotSeverity(p.trang_thai_hsd ?? 'khong_han');
  }

  toggleLots(p: Product) {
    const key = String(p.MaSanPham);
    this.expanded.update((e) => {
      const next = { ...e };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  openLotExpiry(l: Lot) {
    this.lotTarget.set(l);
    this.lotDate.set(l.HanSuDung ?? '');
    this.lotError.set(null);
  }

  onLotEnter(e: Event) {
    if (!plainEnter(e) || !this.lotTarget() || this.lotBusy()) return;
    e.preventDefault();
    this.saveLotExpiry();
  }

  saveLotExpiry() {
    const l = this.lotTarget();
    if (!l) return;

    this.lotBusy.set(true);
    this.lotError.set(null);
    this.lotService.setExpiry(l.MaLoHang, this.lotDate() || null).subscribe({
      next: (res) => {
        this.lotBusy.set(false);
        this.lotTarget.set(null);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.lotBusy.set(false);
        this.lotError.set(this.errorText(e));
      },
    });
  }

  // ---------- Xóa, hiện lại ----------

  async remove(p: Product) {
    const ok = await this.confirmDialog.ask({
      title: 'Xóa sản phẩm',
      message:
        `Bạn có chắc muốn xóa "${p.TenSanPham}"?\n` +
        'Nếu sản phẩm đã có trong hóa đơn hoặc phiếu nhập, hệ thống chỉ ẩn sản phẩm này thay vì xóa.',
      confirmLabel: 'Xóa sản phẩm',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.service.remove(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }

  restore(p: Product) {
    this.busy.set(true);
    this.service.restore(p.MaSanPham).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify(res.message);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.errorText(e));
      },
    });
  }

  // ---------- Thêm, sửa ----------

  openCreate() {
    this.editing.set(null);
    this.formError.set(null);
    this.resetImage(null);
    this.form.reset({
      TenSanPham: '', MaDanhMuc: null, TenThuongHieu: '', MaNhaCungCap: null,
      DonGiaNhap: null, DonGiaBan: null, TonKhoToiThieu: 0, TonKhoToiDa: null,
      CanhBaoHSD: null, MoTa: '', ThanhPhan: '',
    });
    this.dialogOpen.set(true);
  }

  openEdit(p: Product) {
    this.editing.set(p);
    this.formError.set(null);
    this.resetImage(p.hinh_anh_url ?? null);
    this.form.reset({
      TenSanPham: p.TenSanPham,
      MaDanhMuc: p.MaDanhMuc != null ? Number(p.MaDanhMuc) : null,
      TenThuongHieu: p.TenThuongHieu ?? '',
      MaNhaCungCap: p.MaNhaCungCap != null ? Number(p.MaNhaCungCap) : null,
      DonGiaNhap: num(p.DonGiaNhap as number | null),
      DonGiaBan: num(p.DonGiaBan as number),
      TonKhoToiThieu: p.TonKhoToiThieu,
      TonKhoToiDa: p.TonKhoToiDa ?? null,
      CanhBaoHSD: p.CanhBaoHSD ?? null,
      MoTa: p.MoTa ?? '',
      ThanhPhan: p.ThanhPhan ?? '',
    });
    this.dialogOpen.set(true);
  }

  onEnter(e: Event) {
    if (!plainEnter(e) || this.form.invalid || this.busy()) return;
    e.preventDefault();
    this.save();
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const body: ProductPayload = {
      TenSanPham: (v.TenSanPham ?? '').trim(),
      MaDanhMuc: Number(v.MaDanhMuc),
      TenThuongHieu: text(v.TenThuongHieu),
      MaNhaCungCap: Number(v.MaNhaCungCap),
      DonGiaNhap: Number(v.DonGiaNhap),
      DonGiaBan: Number(v.DonGiaBan),
      TonKhoToiThieu: Number(v.TonKhoToiThieu ?? 0),
      TonKhoToiDa: num(v.TonKhoToiDa),
      CanhBaoHSD: num(v.CanhBaoHSD),
      MoTa: text(v.MoTa),
      ThanhPhan: text(v.ThanhPhan),
    };

    const current = this.editing();
    const request = current
      ? this.service.update(current.MaSanPham, body)
      : this.service.create(body);

    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: (res) => {
        const id = current?.MaSanPham ?? res.data.MaSanPham;
        this.saveImage(id).subscribe({
          next: () => this.finishSave(current ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.'),
          error: (e: HttpErrorResponse) =>
            this.finishSave(`Đã lưu sản phẩm nhưng chưa cập nhật được ảnh: ${this.errorText(e)}`),
        });
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(this.errorText(e));
      },
    });
  }

  // ---------- Ảnh sản phẩm ----------

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.formError.set('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.formError.set('Ảnh không được lớn hơn 2 MB.');
      return;
    }

    this.formError.set(null);
    this.revokePreview();
    this.imageFile.set(file);
    this.imageRemoved.set(false);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  clearImage() {
    this.revokePreview();
    this.imageFile.set(null);
    this.imageRemoved.set(true);
    this.imagePreview.set(null);
  }

  private resetImage(url: string | null) {
    this.revokePreview();
    this.imageFile.set(null);
    this.imageRemoved.set(false);
    this.imagePreview.set(url);
  }

  private revokePreview() {
    const url = this.imagePreview();
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  private saveImage(id: number | string): Observable<unknown> {
    const file = this.imageFile();
    if (file) return this.service.uploadImage(id, file);
    if (this.imageRemoved()) return this.service.removeImage(id);
    return of(null);
  }

  private finishSave(message: string) {
    this.busy.set(false);
    this.dialogOpen.set(false);
    this.notify(message);
    this.load();
  }

  // ---------- Thông báo ----------

  private notify(message: string) {
    this.success.set(message);
    this.error.set(null);
    setTimeout(() => this.success.set(null), 4000);
  }

  private errorText(e: HttpErrorResponse): string {
    const errs = e.error?.errors as Record<string, string[] | undefined>;
    if (errs) return Object.values(errs).flat().join(' ');
    return e.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  }
}
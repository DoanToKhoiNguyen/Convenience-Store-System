import { Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmService, ConfirmTone } from './confirm.service';

const LOOK: Record<ConfirmTone, { icon: string; box: string }> = {
    danger: { icon: 'pi pi-trash', box: 'bg-red-100 text-red-600' },
    warn: { icon: 'pi pi-exclamation-triangle', box: 'bg-amber-100 text-amber-600' },
    info: { icon: 'pi pi-question-circle', box: 'bg-sky-100 text-sky-600' },
};

@Component({
    selector: 'app-confirm-host',
    imports: [DialogModule, ButtonModule],
    template: `
    <p-dialog
      [modal]="true"
      [showHeader]="false"
      [draggable]="false"
      [dismissableMask]="true"
      [visible]="!!service.state()"
      (visibleChange)="!$event && service.answer(false)"
      (keydown.enter)="onEnter($event)"
      [style]="{ width: 'min(28rem, 94vw)' }"
    >
      @if (service.state(); as s) {
        <div class="flex gap-4 pt-2">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" [class]="look().box">
            <i [class]="look().icon"></i>
          </span>
          <div class="min-w-0">
            <h3 class="text-lg font-semibold text-slate-800">{{ s.title }}</h3>
            <p class="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{{ s.message }}</p>
          </div>
        </div>
      }

      <ng-template #footer>
        <p-button [label]="service.state()?.cancelLabel ?? 'Hủy'" [text]="true" (onClick)="service.answer(false)" />
        <p-button
          [label]="service.state()?.confirmLabel ?? 'Đồng ý'"
          [severity]="severity()"
          (onClick)="service.answer(true)"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ConfirmHost {
    protected service = inject(ConfirmService);

    readonly look = computed(() => LOOK[this.service.state()?.tone ?? 'info']);
    readonly severity = computed(() => {
        const t = this.service.state()?.tone;
        return t === 'danger' ? 'danger' : t === 'warn' ? 'warn' : undefined;
    });

    // Enter = đồng ý với hộp xác nhận của ứng dụng
    onEnter(e: Event) {
        e.preventDefault();
        this.service.answer(true);
    }

    constructor() {
        // Enter = đồng ý với p-confirmdialog của PrimeNG (không phải component của mình)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const accept = document.querySelector<HTMLElement>('.p-confirmdialog .p-confirmdialog-accept-button');
            if (!accept) return;
            e.preventDefault();
            accept.click();
        });
    }
}
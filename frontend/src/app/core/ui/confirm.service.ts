import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'danger' | 'warn' | 'info';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
}

interface ConfirmState extends ConfirmOptions {
    resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
    readonly state = signal<ConfirmState | null>(null);

    // Trả về true nếu người dùng bấm xác nhận, false nếu hủy hoặc đóng hộp thoại
    ask(options: ConfirmOptions): Promise<boolean> {
        this.state()?.resolve(false);
        return new Promise<boolean>((resolve) => this.state.set({ ...options, resolve }));
    }

    answer(ok: boolean) {
        const s = this.state();
        if (!s) return;
        this.state.set(null);
        s.resolve(ok);
    }
}
import { AuthUser, PasswordPayload, ProfilePayload } from './auth.models';
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginResponse {
    message: string;
    access_token: string;
    token_type: string;
    user: AuthUser;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Phiên đăng nhập chỉ lưu theo từng tab (sessionStorage): mở hai tab có thể đăng nhập hai tài khoản khác nhau.
// Mọi thao tác đều bọc try/catch phòng khi trình duyệt chặn lưu trữ.
const store = {
    get(key: string): string | null {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string) {
        try {
            sessionStorage.setItem(key, value);
        } catch {
            // không lưu được thì bỏ qua, phiên vẫn chạy trong bộ nhớ của tab
        }
    },
    remove(key: string) {
        try {
            sessionStorage.removeItem(key);
        } catch {
            // bỏ qua
        }
    },
};

function readStoredUser(): AuthUser | null {
    try {
        return JSON.parse(store.get(USER_KEY) ?? 'null');
    } catch {
        return null;
    }
}

// Bản cũ lưu phiên trong localStorage (dùng chung mọi tab): xóa đi để không còn token nằm lại
function cleanLegacy() {
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch {
        // bỏ qua
    }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    readonly token = signal<string | null>(store.get(TOKEN_KEY));
    readonly user = signal<AuthUser | null>(readStoredUser());
    readonly isLoggedIn = computed(() => !!this.token());

    constructor() {
        cleanLegacy();
    }

    // Gọi lúc khởi động để xác thực lại token với backend
    verify() {
        if (!this.token()) return of(null);
        return this.http.get<any>(`${environment.apiUrl}/me`).pipe(
            tap((res) => {
                const fresh = res?.user ?? res?.data ?? res;
                if (!fresh || typeof fresh !== 'object') return;

                const current = this.user();
                const role = Number(fresh.MaVaiTro ?? current?.MaVaiTro);
                if (!role) return; // /me không có vai trò: giữ nguyên thông tin đã lưu

                const user = { ...current, ...fresh, MaVaiTro: role } as AuthUser;
                store.set(USER_KEY, JSON.stringify(user));
                this.user.set(user);
            }),
            catchError(() => of(null)),
        );
    }

    login(username: string, password: string) {
        const body = {
            TenDangNhap: username,
            MatKhau: password,
        };

        return this.http
            .post<LoginResponse>(`${environment.apiUrl}/login`, body)
            .pipe(
                tap((res) =>
                    this.save(res.access_token, {
                        ...res.user,
                        MaVaiTro: Number(res.user.MaVaiTro), // backend trả chuỗi "1", đổi sang số
                    }),
                ),
            );
    }

    logout() {
        // Gọi API hủy token (kết quả không quan trọng)
        this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({
            error: () => { },
        });

        // Đăng xuất ở frontend luôn, không chờ backend
        this.clear();
    }

    can(permission: string): boolean {
        return this.user()?.permissions?.includes(permission) ?? false;
    }

    hasAnyRole(roles: number[]): boolean {
        const u = this.user();
        if (!u) return false;
        const mine = [u.MaVaiTro, ...(u.roles ?? [])].map(Number);
        return roles.some((r) => mine.includes(r));
    }

    clear() {
        store.remove(TOKEN_KEY);
        store.remove(USER_KEY);
        this.token.set(null);
        this.user.set(null);
        this.router.navigate(['/login']);
    }

    updateProfile(body: ProfilePayload) {
        return this.http
            .put<{ user: AuthUser }>(`${environment.apiUrl}/me`, body)
            .pipe(tap((res) => this.setUser(res.user)));
    }

    changePassword(body: PasswordPayload) {
        return this.http.put(`${environment.apiUrl}/me/mat-khau`, body);
    }

    private setUser(u: AuthUser) {
        const user = { ...u, MaVaiTro: Number(u.MaVaiTro) };
        store.set(USER_KEY, JSON.stringify(user));
        this.user.set(user); // tên ở thanh trên cùng cập nhật ngay
    }

    private save(token: string, user: AuthUser) {
        store.set(TOKEN_KEY, token);
        store.set(USER_KEY, JSON.stringify(user));
        this.token.set(token);
        this.user.set(user);
    }
}
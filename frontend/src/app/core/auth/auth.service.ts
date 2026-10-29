import { AuthUser } from './auth.models';
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginResponse {
    message: string;
    access_token: string;
    token_type: string;
    user: AuthUser;
}

@Injectable({ providedIn: 'root' })

export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    readonly token = signal<string | null>(localStorage.getItem('token'));
    readonly user = signal<AuthUser | null>(
        JSON.parse(localStorage.getItem('user') ?? 'null'),
    );
    readonly isLoggedIn = computed(() => !!this.token());

    login(username: string, password: string) {
        return this.http
            .post<LoginResponse>(`${environment.apiUrl}/login`, {
                TenDangNhap: username,
                MatKhau: password,
            })
            .pipe(
                tap((res) =>
                    this.save(res.access_token, {
                        ...res.user,
                        MaVaiTro: Number(res.user.MaVaiTro), // backend trả chuỗi "1", đổi sang số
                    }),
                ),
            );
    }

    // logout() {
    //     this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({ complete: () => this.clear() });
    // }
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.token.set(null);
        this.user.set(null);
        this.router.navigate(['/login']);
    }

    private save(token: string, user: AuthUser) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        this.token.set(token);
        this.user.set(user);
    }

}
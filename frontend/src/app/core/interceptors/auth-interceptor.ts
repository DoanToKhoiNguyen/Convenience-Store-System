import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authReq = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const isLogin = req.url.endsWith('/login');

      // Kiểm tra lỗi 401 (trừ khi đang gọi API login) hoặc lỗi 403 tài khoản bị khóa
      const isUnauthorized = err.status === 401 && !isLogin;
      const isAccountLocked = err.status === 403; // Hoặc kèm thêm điều kiện tùy backend: err.error?.code === 'ACCOUNT_LOCKED'

      if (isUnauthorized || isAccountLocked) {
        auth.clear(); // Xóa token/user và đá về trang đăng nhập
      }

      return throwError(() => err);
    }),
  );
};
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.isLoggedIn() || router.createUrlTree(['/login']);
};

export const roleGuard = (...roles: number[]): CanActivateFn => () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasAnyRole(roles) || router.createUrlTree(['/403']);
};
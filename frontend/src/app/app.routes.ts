import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/guards';
import { ROLE } from './core/auth/roles';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
    },
    {
        path: 'admin',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./layouts/admin-layout/admin-layout').then((m) => m.AdminLayout),
        children: [
            {
                path: '',
                pathMatch: 'full',
                loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
            },
            {
                path: 'staff',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () =>
                    import('./features/staff/staff-list').then((m) => m.StaffList),
            },
            {
                path: 'products',
                loadComponent: () => import('./features/products/product-list').then((m) => m.ProductList),
            },
            {
                path: 'purchases',
                loadComponent: () => import('./features/purchases/purchase-list').then((m) => m.PurchaseList),
            },
            {
                path: 'bills', // Hoặc đường dẫn bạn muốn (ví dụ: 'sales')
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/bill/bill-list').then((m) => m.BillList),
            },
            {
                path: 'lich-su-ton-kho',
                loadComponent: () => import('./features/products/lich-su-ton-kho/lich-su-ton-kho.component').then(m => m.LichSuTonKhoComponent)
            },
            {
                path: 'sales',
                loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
            },
            {
                path: 'stock-alerts',
                loadComponent: () => import('./features/stock/stock-alerts').then((m) => m.StockAlerts),
            },
        ],

    },
    {
        path: '403',
        loadComponent: () => import('./features/errors/forbidden').then((m) => m.Forbidden),
    },
    { path: '', pathMatch: 'full', redirectTo: 'admin' },
    { path: '**', redirectTo: 'admin' },
];
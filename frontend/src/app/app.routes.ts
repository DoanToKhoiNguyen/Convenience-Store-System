import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/guards';
import { ROLE } from './core/auth/roles';
import { inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';

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
                redirectTo: () =>
                    inject(AuthService).hasAnyRole([ROLE.OWNER, ROLE.MANAGER])
                        ? '/admin/timetable'
                        : '/admin/shift-register',
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
                path: 'bills',
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
            {
                path: 'profile',
                loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
            },
            {
                path: 'suppliers',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/suppliers/supplier-list').then((m) => m.SupplierList),
            },
            {
                path: 'invoices',
                loadComponent: () => import('./features/invoices/invoice-list').then((m) => m.InvoiceList),
            },
            {
                path: 'stock-history',
                loadComponent: () =>
                    import('./features/products/lich-su-ton-kho/lich-su-ton-kho.component').then(
                        (m) => m.LichSuTonKhoComponent,
                    ),
            },
            {
                path: 'shift-register',
                loadComponent: () => import('./features/shifts/shift-register').then((m) => m.ShiftRegister),
            },
            {
                path: 'timetable',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/shifts/shift-timetable').then((m) => m.ShiftTimetable),
            },
            {
                path: 'promotions',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/promotions/promotion-list').then((m) => m.PromotionList),
            },
            {
                path: 'stock-update',
                loadComponent: () => import('./features/stock/stock-update').then((m) => m.StockUpdate),
            },
            {
                path: 'reports',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/reports/revenue-report').then((m) => m.RevenueReport_),
            },
            {
                path: 'categories',
                canActivate: [roleGuard(ROLE.OWNER, ROLE.MANAGER)],
                loadComponent: () => import('./features/categories/category-list').then((m) => m.CategoryList),
            },
            {
                path: 'expiry-alerts',
                loadComponent: () => import('./features/lots/expiry-alerts').then((m) => m.ExpiryAlerts),
            },
        ],

    },
    {
        path: '403',
        loadComponent: () => import('./features/errors/forbidden').then((m) => m.Forbidden),
    },
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/public/home').then((m) => m.PublicHome),
    },
    { path: '**', redirectTo: '' },
];
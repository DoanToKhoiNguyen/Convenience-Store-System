import {
  ApplicationConfig, provideZonelessChangeDetection, isDevMode,
  LOCALE_ID, provideAppInitializer, inject,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { AuthService } from './core/auth/auth.service';

registerLocaleData(localeVi);

// Màu chính của PrimeNG = indigo (Aura mặc định là emerald)
const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: { preset: AppPreset, options: { darkModeSelector: false } },
      ripple: true,
      translation: {
        dateFormat: 'dd/mm/yy',
        firstDayOfWeek: 1,
        dayNames: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
        dayNamesShort: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
        dayNamesMin: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
        monthNames: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
        monthNamesShort: ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'],
        today: 'Hôm nay',
        clear: 'Xóa',
        weekHeader: 'Tuần',
        chooseDate: 'Chọn ngày',
        chooseMonth: 'Chọn tháng',
        chooseYear: 'Chọn năm',
        prevMonth: 'Tháng trước',
        nextMonth: 'Tháng sau',
        prevYear: 'Năm trước',
        nextYear: 'Năm sau',
      },
      license: 'eyJpZCI6ImVjMzE3Mzg4LTE2MDQtNDk2Yi1hNzJlLTY4YzMwYTJmYTJkYSIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTQ3MTY3MzAsImV4cCI6MTgyNjI1MjczMH0.M7qV08nF1qkdPfKKQzczxnO6sCd9fH7oxBR8lDFCa5TM3My2EefoegMsKS08v-OzDFALF4UVzuoNNokZ3z9FBg',
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => firstValueFrom(inject(AuthService).verify())),
    { provide: LOCALE_ID, useValue: 'vi' },
  ],
};
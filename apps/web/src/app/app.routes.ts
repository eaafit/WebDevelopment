import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'payment-history',
    loadComponent: () =>
      import('./features/payments/payment-history/payment-history').then((m) => m.PaymentHistory),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin_panel/admin-menu/admin-menu').then((m) => m.AdminMenuComponent),
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/admin_panel/admin-users/admin-users').then((m) => m.AdminUsersComponent),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

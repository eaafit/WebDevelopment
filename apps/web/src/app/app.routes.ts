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
    loadComponent: () =>
      import('./features/common/landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

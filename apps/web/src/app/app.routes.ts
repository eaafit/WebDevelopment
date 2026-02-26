import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'applicant/estimation-form',
    loadComponent: () =>
      import('./features/applicant/estimation-form/estimation-form').then((m) => m.EstimationForm),
  },
  {
    path: 'applicant',
    pathMatch: 'full',
    redirectTo: 'applicant/estimation-form',
  },
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
    path: 'landing',
    loadComponent: () =>
      import('./features/common/landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'applicant/estimation-form',
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

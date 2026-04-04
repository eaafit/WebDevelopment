import { Route } from '@angular/router';
import { Guest } from './guest/guest';
import { TestPage } from './features/test-page/test-page';
import { LandingPage } from './features/landing-page/landing-page';
import { TransactionTable } from '@notary-portal/ui';
import { PlaceholderPageRoute } from '@notary-portal/ui';

export const guestRoutes: Route[] = [
  {
    path: '',
    component: Guest,
    children: [
      { path: '', component: TestPage },
      { path: 'landing-page', component: LandingPage },
      {
        path: 'auth',
        loadComponent: () => import('./features/auth/auth-shell/auth-shell').then((m) => m.AuthShell),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
          },
          {
            path: 'forgot-password',
            loadComponent: () =>
              import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
          },
          {
            path: 'reset-password',
            loadComponent: () =>
              import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
          },
        ],
      },
      {
        path: 'transactions',
        component: TransactionTable,
      },
      {
        path: 'faq',
        component: PlaceholderPageRoute,
        data: {
          title: 'Справочный раздел',
          features: ['База знаний', 'FAQ', 'Поиск по статьям', 'Фильтры по автору и логике поиска'],
        },
      },
    ],
  },
];

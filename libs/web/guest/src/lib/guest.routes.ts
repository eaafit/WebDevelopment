import { Route } from '@angular/router';
import { Guest } from './guest/guest';
import { TestPage } from './features/test-page/test-page';
import { LandingPage } from './features/landing-page/landing-page';
import { TransactionTable } from '@notary-portal/ui';

export const guestRoutes: Route[] = [
  {
    path: '',
    component: Guest,
    children: [
      { path: '', component: TestPage },
      { path: 'landing-page', component: LandingPage },
      {
        path: 'auth',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'transactions',
        component: TransactionTable,
      },
    ],
  },
];

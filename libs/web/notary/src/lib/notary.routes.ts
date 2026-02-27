import { Route } from '@angular/router';
import { Notary } from './notary/notary';

export const notaryRoutes: Route[] = [
  {
    path: '',
    component: Notary,
    children: [
      {
        path: 'subscription/checkout',
        loadComponent: () =>
          import('./features/subscription/checkout/checkout').then((m) => m.Checkout),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/dashboard/transactions/transactions').then((m) => m.Transactions),
      },
    ],
  },
];

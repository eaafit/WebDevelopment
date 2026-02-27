import { Route } from '@angular/router';
import { Applicant } from './applicant/applicant';

export const applicantRoutes: Route[] = [
  {
    path: '',
    component: Applicant,
    children: [
      {
        path: 'checkout',
        loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
      },
    ],
  },
];

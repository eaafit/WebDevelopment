import { Route } from '@angular/router';
import { guestRoutes } from '@notary-portal/guest';

export const appRoutes: Route[] = [
  {
    path: '',
    children: guestRoutes,
  },
  {
    path: 'applicant',
    loadChildren: () => import('@notary-portal/applicant').then((m) => m.applicantRoutes),
  },
  {
    path: 'notary',
    loadChildren: () => import('@notary-portal/notary').then((m) => m.notaryRoutes),
  },
  {
    path: 'admin',
    loadChildren: () => import('@notary-portal/admin').then((m) => m.adminRoutes),
  },
];

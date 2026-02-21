import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () => import('@notary-portal/guest').then((m) => m.guestRoutes),
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

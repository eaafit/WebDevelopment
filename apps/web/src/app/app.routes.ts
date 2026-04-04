import { Route } from '@angular/router';
import { guestRoutes } from '@notary-portal/guest';
import { authGuard, roleGuard } from '@notary-portal/ui';
import { UserRole } from '@notary-portal/ui';

export const appRoutes: Route[] = [
  {
    path: '',
    children: guestRoutes,
  },
  {
    path: 'applicant',
    canActivate: [authGuard, roleGuard(UserRole.Applicant)],
    loadChildren: () => import('@notary-portal/applicant').then((m) => m.applicantRoutes),
  },
  {
    path: 'notary',
    canActivate: [authGuard, roleGuard(UserRole.Notary)],
    loadChildren: () => import('@notary-portal/notary').then((m) => m.notaryRoutes),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(UserRole.Admin)],
    loadChildren: () => import('@notary-portal/admin').then((m) => m.adminRoutes),
  },
];

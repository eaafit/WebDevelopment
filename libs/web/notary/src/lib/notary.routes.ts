import { Route } from '@angular/router';
import { Notary } from './notary/notary';
import { PlaceholderPageRoute } from '@notary-portal/ui';
import { Dashboard } from './features/dashboard/dashboard';
import { AssessmentHistoryComponent } from '@notary-portal/ui';
import { Copy, List, New } from '@notary-portal/ui';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const notaryRoutes: Route[] = [
  {
    path: '',
    component: Notary,
    children: [
      { path: '', component: Dashboard },
      {
        path: 'orders',
        loadComponent: () => import('./features/assessment/assessment').then((m) => m.Assessment),
      },
      {
        path: 'subscription',
        loadComponent: () => import('./features/subscription/checkout/checkout').then((m) => m.Checkout),
      },
      {
        path: 'transactions',
        loadComponent: () => import('./features/dashboard/transactions/transactions').then((m) => m.Transactions),
      },
      {
        path: 'assessment',
        loadComponent: () => import('./features/dashboard/assessment/assessment').then((m) => m.RequestPrice),
      },
      {
        path: 'monitoring',
        loadComponent: () => import('./features/monitoring/monitoring').then((m) => m.Monitoring),
      },
      {
        path: 'assessment/history',
        component: AssessmentHistoryComponent,
        data: { role: 'notary' },
      },
      {
        path: 'copies',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: List,
            data: { role: 'notary' },
          },
          {
            path: 'new',
            component: New,
          },
          {
            path: ':id',
            component: Copy,
          },
        ],
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/notifications/notifications').then((m) => m.NotaryNotifications),
      },
      {
        path: 'support',
        ...placeholder('Чат поддержки', ['Чат/тикеты', 'Вложения']),
      } as Route,
      {
        path: 'faq',
        ...placeholder('Справочник', ['База знаний', 'FAQ', 'Поиск по статьям']),
      } as Route,
    ],
  },
];
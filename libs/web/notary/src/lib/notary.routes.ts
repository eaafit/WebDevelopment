import { Route } from '@angular/router';
import { Notary } from './notary/notary';
import { PlaceholderPageRoute } from '@notary-portal/ui';
import { Dashboard } from './features/dashboard/dashboard';
import { AssessmentHistoryComponent } from '@notary-portal/ui';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const notaryRoutes: Route[] = [
  {
    path: '',
    component: Notary,
    children: [
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders-list/orders-list').then((m) => m.OrdersList),
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/orders/order-detail/order-detail').then((m) => m.OrderDetail),
      },
      { path: '', component: Dashboard },
      {
        path: 'subscription',
        loadComponent: () => import('./features/subscription-plan/subscription-plan').then((m) => m.SubscriptionPlan),
      },
      {
        path: 'subscription/checkout/success',
        loadComponent: () =>
          import('./features/subscription/checkout/checkout').then((m) => m.Checkout),
      },
      {
        path: 'subscription/checkout/cancel',
        loadComponent: () =>
          import('./features/subscription/checkout/checkout').then((m) => m.Checkout),
      },
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
      {
        path: 'assessment',
        loadComponent: () =>
          import('./features/dashboard/assessment/assessment').then((m) => m.RequestPrice),
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
        ...placeholder('Копии документов', [
          'Запрос, оплата и получение копий',
          'Статус «в обработке/готово»',
        ]),
      } as Route,
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.NotaryNotifications),
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

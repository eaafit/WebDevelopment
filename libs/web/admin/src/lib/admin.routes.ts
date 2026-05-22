import { Route } from '@angular/router';
import { Admin } from './admin/admin';
import { PlaceholderPageRoute } from '@notary-portal/ui';
import { Payments } from './features/payments/payments';
import { PaymentFormComponent } from './features/payments/payment-form.component';
import { PlansListComponent } from './features/plans/plans-list/plans-list';
import { PromoCodesComponent } from './features/promo-codes/promo-codes';
import { SubscriptionsListComponent } from './features/subscriptions/subscriptions-list/subscriptions-list';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const adminRoutes: Route[] = [
  {
    path: '',
    component: Admin,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.AdminDashboard),
      } as Route,
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/RequestAssessment/RequestAssessment').then((m) => m.RequestAssessment),
      },
      {
        path: 'orders/statuses',
        ...placeholder('Управление статусами', [
          'Изменение статусов заказов',
          'Отслеживание переходов между этапами',
        ]),
      } as Route,
      {
        path: 'orders/queue',
        ...placeholder('Очередь оценок', [
          'Список заявок, ожидающих оценки',
          'Распределение по нотариусам',
        ]),
      } as Route,
      {
        path: 'orders/moderation',
        ...placeholder('Ручная модерация', [
          'Проверка и модерация спорных заявок',
          'Ручные корректировки',
        ]),
      } as Route,
      {
        path: 'order-status-history',
        loadComponent: () =>
          import('./features/order-status-history/order-status-history').then(
            (m) => m.OrderStatusHistory,
          ),
      },
      {
        path: 'payments/new',
        component: PaymentFormComponent,
      },
      {
        path: 'payments/:id/edit',
        component: PaymentFormComponent,
      },
      {
        path: 'payments',
        component: Payments,
      },

      {
        path: 'subscriptions',
        component: SubscriptionsListComponent,
      },
      {
        path: 'plans',
        component: PlansListComponent,
      },
      {
        path: 'discounts',
        loadComponent: () => import('./features/sale/sale').then((m) => m.SaleComponent),
      } as Route,
      {
        path: 'promocodes',
        component: PromoCodesComponent,
      },
      {
        path: 'files',
        ...placeholder('Модерация файлов', [
          'Модерация загруженных файлов',
          'Статусы «принято/на проверке»',
        ]),
      } as Route,
      {
        path: 'newsletter/new',
        loadComponent: () =>
          import('./features/newsletter/newsletter-new').then((m) => m.NewsletterNew),
      },
      {
        path: 'newsletter/history',
        loadComponent: () =>
          import('./features/newsletter/newsletter-list/newsletter-list').then(
            (m) => m.NewsletterListComponent,
          ),
      },
      {
        path: 'newsletter',
        loadComponent: () => import('./features/newsletter/newsletter').then((m) => m.Newsletter),
      },
      {
        path: 'monitoring',
        loadComponent: () => import('./features/monitoring/monitoring').then((m) => m.Monitoring),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.AdminNotifications),
      },
      {
        path: 'statistics',
        ...placeholder('Статистика', ['Метрики (конверсия/время)', 'Отчёты', 'Выгрузки']),
      } as Route,
      {
        path: 'geography',
        loadComponent: () => import('./features/geography/geography').then((m) => m.Geography),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/smtp-settings/smtp-settings').then((m) => m.SmtpSettings),
      },
      {
        path: 'bitrix/config',
        loadComponent: () =>
          import('./features/bitrix/bitrix-config.component').then((m) => m.BitrixConfigComponent),
      },
      {
        path: 'bitrix/sync',
        loadComponent: () =>
          import('./features/bitrix/bitrix-sync.component').then((m) => m.BitrixSyncComponent),
      },
    ],
  },
];

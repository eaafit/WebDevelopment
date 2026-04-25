import { Route } from '@angular/router';
import { Admin } from './admin/admin';
import { PlaceholderPageRoute } from '@notary-portal/ui';
import { Payments } from './features/payments/payments';
import { Applications } from './features/applications/applications';
import { PaymentFormComponent } from './features/payments/payment-form.component';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const adminRoutes: Route[] = [
  {
    path: '',
    component: Admin,
    children: [
      { path: '', ...placeholder('Главное меню', ['Обзор панели администратора']) } as Route,
      {
        path: 'users',
        loadComponent: () =>
          import('./features/RequestAssessment/RequestAssessment').then((m) => m.RequestAssessment),
      } as Route,
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/RequestAssessment/requests/requests').then((m) => m.RequestsComponent),
      } as Route,
      {
        path: 'order-status-history',
        loadComponent: () =>
          import('./features/order-status-history/order-status-history').then(
            (m) => m.OrderStatusHistory,
          ),
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
        path: 'applications',
        component: Applications,
      },
      {
        path: 'subscriptions',
        ...placeholder('Подписки', ['Просмотр списка подписок']),
      } as Route,
      {
        path: 'plans',
        ...placeholder('Тарифные планы', ['Просмотр тарифных планов', 'Скидки', 'Промокоды']),
      } as Route,
      {
        path: 'files',
        ...placeholder('Модерация файлов', [
          'Модерация загруженных файлов',
          'Статусы «принято/на проверке»',
        ]),
      } as Route,
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

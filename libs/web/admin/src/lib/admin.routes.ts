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
        ...placeholder('Пользователи и заказы', [
          'CRUD пользователей',
          'Роли и права',
          'Блокировки',
          'Управление заказами/статусами',
          'Ручные корректировки',
          'Модерация файлов',
        ]),
      } as Route,
      {
        path: 'orders',
        ...placeholder('Заявки', [
          'Управление заказами',
          'Управление статусами',
          'Очередь оценок',
          'Ручная модерация',
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
        ...placeholder('Уведомления', ['Управление уведомлениями']),
      } as Route,
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
    ],
  },
];

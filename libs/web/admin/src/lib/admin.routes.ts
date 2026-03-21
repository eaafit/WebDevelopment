import { Route } from '@angular/router';
import { Admin } from './admin/admin';
import { PlaceholderPageRoute } from '@notary-portal/ui';

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
        ...placeholder('Заявки', [
          'Управление заказами',
          'Управление статусами',
          'Очередь оценок',
          'Ручная модерация',
        ]),
      } as Route,
      {
        path: 'payments',
        ...placeholder('Платежи', [
          'Список платежей/транзакций',
          'Формы создания/редактирования',
          'Модальное окно удаления',
        ]),
      } as Route,
      {
        path: 'subscriptions',
        ...placeholder('Подписки', ['Просмотр списка подписок']),
      } as Route,
      {
        path: 'plans',
        loadComponent: () => import('./features/plan/plan').then((m) => m.PlanComponent),
      } as Route,
      {
        path: 'discounts',
        loadComponent: () => import('./features/sale/sale').then((m) => m.SaleComponent),
      } as Route,
      {
        path: 'promocodes',
        loadComponent: () => import('./features/promo/promo').then((m) => m.PromoComponent),
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
        ...placeholder('Рассылка', ['Список рассылки', 'Формирование рассылки email']),
      } as Route,
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
        ...placeholder('Настройки', ['Конфигурация системы']),
      } as Route,
    ],
  },
];

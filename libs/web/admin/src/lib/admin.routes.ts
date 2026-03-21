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
        loadComponent: () =>
          import('./features/RequestAssessment/RequestAssessment').then((m) => m.RequestAssessment),
      } as Route,
      {
        path: 'orders/requests',
        ...placeholder('Заявки', [
          'Список заявок на оценку',
          'Просмотр деталей заявки',
          'Назначение нотариуса',
        ]),
      } as Route,
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

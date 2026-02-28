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
        ...placeholder('Подписки', [
          'Просмотр списка подписок',
        ]),
      } as Route,
      {
        path: 'plans',
        ...placeholder('Тарифные планы', [
          'Просмотр тарифных планов',
          'Скидки',
          'Промокоды',
        ]),
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
        ...placeholder('Рассылка', [
          'Список рассылки',
          'Формирование рассылки email',
        ]),
      } as Route,
      {
        path: 'monitoring',
        ...placeholder('Мониторинг и логи', [
          'Аудит действий (кто/что/когда)',
          'Фильтры',
          'Экспорт',
          'Логи по пользователю/заказу',
          'События безопасности',
        ]),
      } as Route,
      {
        path: 'notifications',
        ...placeholder('Уведомления', [
          'Управление уведомлениями',
        ]),
      } as Route,
      {
        path: 'statistics',
        ...placeholder('Статистика', [
          'Метрики (конверсия/время)',
          'Отчёты',
          'Выгрузки',
        ]),
      } as Route,
      {
        path: 'settings',
        ...placeholder('Настройки', [
          'Конфигурация системы',
        ]),
      } as Route,
    ],
  },
];

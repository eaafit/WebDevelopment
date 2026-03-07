import { Route } from '@angular/router';
import { Notary } from './notary/notary';
import { PlaceholderPageRoute } from '@notary-portal/ui';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const notaryRoutes: Route[] = [
  {
    path: '',
    component: Notary,
    children: [
      { path: '', ...placeholder('Главная', ['Обзор кабинета нотариуса']) } as Route,
      {
        path: 'orders',
        ...placeholder('Заказы', [
          'Просмотр заказов',
          'Фильтры и поиск',
          '«Взять в работу»',
          'Управление статусами',
        ]),
      } as Route,
      {
        path: 'subscription',
        ...placeholder('Подписка', [
          'Оплата подписки',
          'Выбор тарифа',
        ]),
      } as Route,
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
        ...placeholder('Модуль оценки', [
          'Запрос оценки с параметрами',
          'Ввод параметров объекта',
          'Результаты и отчёты',
        ]),
      } as Route,
      {
        path: 'copies',
        ...placeholder('Копии документов', [
          'Запрос, оплата и получение копий',
          'Статус «в обработке/готово»',
        ]),
      } as Route,
      {
        path: 'notifications',
        ...placeholder('Уведомления', [
          'In-app уведомления',
          'Настройки каналов (email/push)',
        ]),
      } as Route,
      {
        path: 'support',
        ...placeholder('Чат поддержки', [
          'Чат/тикеты',
          'Вложения',
        ]),
      } as Route,
      {
        path: 'faq',
        ...placeholder('Справочник', [
          'База знаний',
          'FAQ',
          'Поиск по статьям',
        ]),
      } as Route,
    ],
  },
];

import { Route } from '@angular/router';
import { Applicant } from './applicant/applicant';
import { PlaceholderPageRoute } from '@notary-portal/ui';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const applicantRoutes: Route[] = [
  {
    path: '',
    component: Applicant,
    children: [
      { path: '', ...placeholder('Главная', ['Обзор кабинета заявителя']) } as Route,
      {
        path: 'orders',
        ...placeholder('Мои заявки', ['Список заявок', 'Просмотр статусов', 'Фильтры']),
      } as Route,
      {
        path: 'orders/new',
        ...placeholder('Подача заявки', [
          'Ввод данных наследства/объекта',
          'Выбор типа имущества',
          'Прикрепление документов',
          'Согласия/чекбоксы',
          'Отправка',
        ]),
      },
      {
        path: 'documents',
        ...placeholder('Документы', [
          'Загрузка и управление файлами',
          'Предпросмотр PDF/изображений',
          'Версии, теги, статусы',
        ]),
      },
      {
        path: 'assessment/new/params',
        loadComponent: () =>
          import('./features/estimation-form/estimation-form').then((m) => m.EstimationForm),
      } as Route,
      {
        path: 'assessment',
        loadComponent: () =>
          import('./features/estimation-form/estimation-form').then((m) => m.EstimationForm),
      } as Route,
      {
        path: 'assessment/status',
        loadComponent: () =>
          import('./features/assessment-status/assessment-status').then((m) => m.AssessmentStatus),
      } as Route,
      {
        path: 'assessment/results',
        ...placeholder('Результаты оценки', [
          'Итоговая стоимость',
          'Отчёт PDF',
          'Скачивание копий',
        ]),
      },
      {
        path: 'assessment/history',
        ...placeholder('История заказов', [
          'Лента заказов',
          'Статусы и таймлайн',
          'Фильтры',
          'Уведомления по изменениям',
        ]),
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      } as Route,
      {
        path: 'checkout/success',
        loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
      } as Route,
      {
        path: 'checkout/cancel',
        loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
      } as Route,
      {
        path: 'checkout',
        loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
      },
      {
        path: 'copies',
        ...placeholder('Копии документов', [
          'Форма запроса',
          'Прикрепление оснований',
          'Расчёт стоимости',
          'Оплата и выдача копий',
        ]),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.ApplicantNotifications),
      } as Route,
      {
        path: 'support',
        ...placeholder('Чат поддержки', ['Чат/тикеты', 'Вложения', 'SLA-статусы']),
      },
      {
        path: 'faq',
        ...placeholder('Справочник', ['База знаний', 'FAQ', 'Поиск по статьям']),
      },
    ],
  },
];

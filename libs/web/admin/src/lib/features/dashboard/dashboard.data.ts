export interface QuickLink {
  route: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
}

export const QUICK_LINKS: QuickLink[] = [
  {
    route: 'orders',
    eyebrow: 'Заявки',
    icon: '📄',
    title: 'Управление заказами',
    description: 'Полный список заявок, смена статусов, фильтры и поиск.',
  },
  {
    route: 'users',
    eyebrow: 'Пользователи',
    icon: '👥',
    title: 'Пользователи',
    description: 'Клиенты, нотариусы, администраторы — роли и блокировки.',
  },
  {
    route: 'payments',
    eyebrow: 'Финансы',
    icon: '💳',
    title: 'Платежи',
    description: 'История транзакций, экспорт и ручные корректировки.',
  },
  {
    route: 'monitoring',
    eyebrow: 'Аудит',
    icon: '🖥',
    title: 'Мониторинг и логи',
    description: 'Действия пользователей, критичные события, фильтры.',
  },
];

export interface NewsletterItem {
  id: string;
  subject: string;
  sentAt: string;
  recipientCount: number;
  status: 'sent' | 'draft' | 'scheduled';
  previewText: string;
  recipients: string[];
}

export const MOCK_NEWSLETTERS: NewsletterItem[] = [
  {
    id: 'nl-2026-04-30-001',
    subject: 'Итоги апреля: обновления личного кабинета',
    sentAt: '2026-04-30T12:20:00.000Z',
    recipientCount: 128,
    status: 'sent',
    previewText:
      'В апреле мы обновили раздел заявок, добавили быстрый просмотр статусов и улучшили уведомления о документах. В письме собраны основные изменения и короткие инструкции для пользователей.',
    recipients: [
      'ivanova.sofia@example.com',
      'petrov.notary@example.com',
      'admin.office@example.com',
      'client-17@example.com',
      'notary.moscow@example.com',
      'support.receiver@example.com',
    ],
  },
  {
    id: 'nl-2026-05-02-001',
    subject: 'Плановое обслуживание сервиса 2 мая',
    sentAt: '2026-05-02T03:00:00.000Z',
    recipientCount: 94,
    status: 'scheduled',
    previewText:
      'Сообщаем о плановом техническом обслуживании сервиса. В период работ возможны кратковременные задержки обработки заявок и отправки системных уведомлений.',
    recipients: [
      'ops-notary@example.com',
      'manager.region@example.com',
      'client-alerts@example.com',
      'legal-team@example.com',
      'registry@example.com',
    ],
  },
  {
    id: 'nl-2026-04-26-001',
    subject: 'Новые тарифные планы для нотариусов',
    sentAt: '2026-04-26T09:45:00.000Z',
    recipientCount: 42,
    status: 'sent',
    previewText:
      'Рассказываем о новых тарифных планах для нотариусов: расширенные лимиты, дополнительные инструменты аналитики и обновленные условия подключения филиалов.',
    recipients: [
      'notary.ermolenko@example.com',
      'notary.kuznetsov@example.com',
      'office-notary@example.com',
      'notary.spb@example.com',
      'notary.kazan@example.com',
    ],
  },
  {
    id: 'nl-2026-04-24-001',
    subject: 'Черновик: инструкция по загрузке документов',
    sentAt: '2026-04-24T14:10:00.000Z',
    recipientCount: 0,
    status: 'draft',
    previewText:
      'Подготовлен черновик инструкции для заявителей: какие документы можно загрузить в личном кабинете, как отслеживать проверку и что делать при ошибке формата.',
    recipients: [],
  },
  {
    id: 'nl-2026-04-21-001',
    subject: 'Запуск раздела истории статусов заказов',
    sentAt: '2026-04-21T15:30:00.000Z',
    recipientCount: 156,
    status: 'sent',
    previewText:
      'В личном кабинете появился раздел истории статусов заказов. Пользователи могут видеть все изменения по заявке, дату обновления и комментарии администратора.',
    recipients: [
      'history.user1@example.com',
      'history.user2@example.com',
      'history.user3@example.com',
      'history.user4@example.com',
      'history.user5@example.com',
      'history.user6@example.com',
    ],
  },
  {
    id: 'nl-2026-04-18-001',
    subject: 'Напоминание о подтверждении email',
    sentAt: '2026-04-18T08:00:00.000Z',
    recipientCount: 63,
    status: 'sent',
    previewText:
      'Напоминаем пользователям, которые еще не подтвердили email, завершить регистрацию. Подтвержденный адрес нужен для получения уведомлений по заявкам и платежам.',
    recipients: [
      'confirm.01@example.com',
      'confirm.02@example.com',
      'confirm.03@example.com',
      'confirm.04@example.com',
      'confirm.05@example.com',
    ],
  },
  {
    id: 'nl-2026-05-06-001',
    subject: 'Вебинар для администраторов регионов',
    sentAt: '2026-05-06T10:00:00.000Z',
    recipientCount: 18,
    status: 'scheduled',
    previewText:
      'Приглашаем администраторов регионов на вебинар по настройке справочников, работе с промокодами и контролю оплат через административную панель.',
    recipients: [
      'region-admin-1@example.com',
      'region-admin-2@example.com',
      'region-admin-3@example.com',
      'region-admin-4@example.com',
      'region-admin-5@example.com',
    ],
  },
  {
    id: 'nl-2026-04-12-001',
    subject: 'Обновление политики обработки персональных данных',
    sentAt: '2026-04-12T11:00:00.000Z',
    recipientCount: 211,
    status: 'sent',
    previewText:
      'Мы обновили политику обработки персональных данных. В письме описаны ключевые изменения, сроки вступления в силу и ссылка на полную редакцию документа.',
    recipients: [
      'privacy.01@example.com',
      'privacy.02@example.com',
      'privacy.03@example.com',
      'privacy.04@example.com',
      'privacy.05@example.com',
      'privacy.06@example.com',
    ],
  },
  {
    id: 'nl-2026-04-08-001',
    subject: 'Черновик: подборка ответов службы поддержки',
    sentAt: '2026-04-08T13:25:00.000Z',
    recipientCount: 0,
    status: 'draft',
    previewText:
      'Черновик письма с подборкой частых вопросов: восстановление доступа, оплата госпошлины, загрузка вложений и корректировка контактных данных.',
    recipients: [],
  },
  {
    id: 'nl-2026-04-03-001',
    subject: 'Скидки на расширенный пакет услуг',
    sentAt: '2026-04-03T07:30:00.000Z',
    recipientCount: 87,
    status: 'sent',
    previewText:
      'Для активных пользователей доступна скидка на расширенный пакет услуг. Расскажите клиентам о преимуществах пакета и сроках действия предложения.',
    recipients: [
      'promo.client1@example.com',
      'promo.client2@example.com',
      'promo.client3@example.com',
      'promo.client4@example.com',
      'promo.client5@example.com',
    ],
  },
  {
    id: 'nl-2026-05-10-001',
    subject: 'Переход на новую форму обратной связи',
    sentAt: '2026-05-10T09:00:00.000Z',
    recipientCount: 135,
    status: 'scheduled',
    previewText:
      'Скоро будет включена новая форма обратной связи. Она поможет быстрее собирать обращения, прикладывать файлы и автоматически распределять заявки между специалистами.',
    recipients: [
      'feedback-1@example.com',
      'feedback-2@example.com',
      'feedback-3@example.com',
      'feedback-4@example.com',
      'feedback-5@example.com',
      'feedback-6@example.com',
    ],
  },
  {
    id: 'nl-2026-03-29-001',
    subject: 'Результаты пилотного запуска сервиса',
    sentAt: '2026-03-29T16:15:00.000Z',
    recipientCount: 73,
    status: 'sent',
    previewText:
      'Пилотный запуск сервиса завершен. Делимся метриками, отзывами пользователей и ближайшими улучшениями, которые войдут в следующий релиз административной панели.',
    recipients: [
      'pilot.01@example.com',
      'pilot.02@example.com',
      'pilot.03@example.com',
      'pilot.04@example.com',
      'pilot.05@example.com',
    ],
  },
];

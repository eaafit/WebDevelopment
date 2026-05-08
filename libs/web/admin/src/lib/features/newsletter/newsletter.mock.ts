export type NewsletterItemStatus = 'sent' | 'draft' | 'scheduled';

export interface NewsletterItem {
  id: string;
  subject: string;
  sentAt: string;
  recipientCount: number;
  status: NewsletterItemStatus;
  previewText: string;
  recipients: string[];
  previewUrl?: string | null;
}

export const MOCK_NEWSLETTERS: NewsletterItem[] = [
  {
    id: 'newsletter-001',
    subject: 'Мартовское обновление тарифов для нотариусов',
    sentAt: '2026-03-22T09:30:00.000Z',
    recipientCount: 248,
    status: 'sent',
    previewText:
      'Здравствуйте! Сообщаем об обновлении тарифных планов и расширении лимитов для нотариальных кабинетов. Новые условия начнут действовать с 1 апреля.',
    recipients: [
      'ivan.petrov@notary.local',
      'anna.smirnova@notary.local',
      'office-12@notary.local',
      'mikhail.kuznetsov@notary.local',
      'elena.volkova@notary.local',
      'support-office@notary.local',
    ],
  },
  {
    id: 'newsletter-002',
    subject: 'Памятка заявителю: подготовка документов',
    sentAt: '2026-03-19T12:10:00.000Z',
    recipientCount: 614,
    status: 'sent',
    previewText:
      'Перед подачей заявки проверьте паспортные данные, правоустанавливающие документы и фотографии объекта. Это ускорит первичную проверку.',
    recipients: [
      'client-001@example.com',
      'client-014@example.com',
      'client-027@example.com',
      'client-048@example.com',
      'client-063@example.com',
      'client-088@example.com',
    ],
  },
  {
    id: 'newsletter-003',
    subject: 'Запланированное обслуживание портала',
    sentAt: '2026-03-28T18:00:00.000Z',
    recipientCount: 902,
    status: 'scheduled',
    previewText:
      'В ночь с пятницы на субботу будет выполнено техническое обслуживание. Личные кабинеты могут быть недоступны до 30 минут.',
    recipients: [
      'admin-team@notary.local',
      'notary-archive@notary.local',
      'client-104@example.com',
      'client-205@example.com',
      'client-306@example.com',
      'client-407@example.com',
    ],
  },
  {
    id: 'newsletter-004',
    subject: 'Черновик: инструкция по оплате подписки',
    sentAt: '2026-03-25T14:00:00.000Z',
    recipientCount: 0,
    status: 'draft',
    previewText:
      'Опишите шаги оплаты подписки, проверку статуса транзакции и получение закрывающих документов после успешного платежа.',
    recipients: [],
  },
  {
    id: 'newsletter-005',
    subject: 'Новые статусы заявок на оценку',
    sentAt: '2026-03-16T08:45:00.000Z',
    recipientCount: 311,
    status: 'sent',
    previewText:
      'В карточке заявки появились дополнительные статусы проверки документов. Теперь заявитель и нотариус видят более точный этап обработки.',
    recipients: [
      'notary-01@example.com',
      'notary-02@example.com',
      'notary-03@example.com',
      'notary-04@example.com',
      'notary-05@example.com',
      'notary-06@example.com',
    ],
  },
  {
    id: 'newsletter-006',
    subject: 'Напоминание о незавершённых заявках',
    sentAt: '2026-03-29T07:15:00.000Z',
    recipientCount: 126,
    status: 'scheduled',
    previewText:
      'У вас есть заявки, которые ожидают загрузки документов или подтверждения параметров объекта недвижимости.',
    recipients: [
      'client-151@example.com',
      'client-152@example.com',
      'client-153@example.com',
      'client-154@example.com',
      'client-155@example.com',
      'client-156@example.com',
    ],
  },
  {
    id: 'newsletter-007',
    subject: 'Черновик: обзор новой панели администратора',
    sentAt: '2026-03-24T10:00:00.000Z',
    recipientCount: 0,
    status: 'draft',
    previewText:
      'Кратко расскажите администраторам о новых разделах: пользователи, заказы, платежи, рассылки и мониторинг безопасности.',
    recipients: [],
  },
  {
    id: 'newsletter-008',
    subject: 'Итоги недели: обработанные оценки',
    sentAt: '2026-03-15T15:20:00.000Z',
    recipientCount: 57,
    status: 'sent',
    previewText:
      'За неделю обработано 57 заявок на оценку. Среднее время проверки документов снизилось, а количество повторных загрузок уменьшилось.',
    recipients: [
      'admin-analytics@notary.local',
      'chief-notary@notary.local',
      'region-ural@notary.local',
      'region-volga@notary.local',
      'region-siberia@notary.local',
    ],
  },
  {
    id: 'newsletter-009',
    subject: 'Обновление политики хранения файлов',
    sentAt: '2026-03-14T11:05:00.000Z',
    recipientCount: 734,
    status: 'sent',
    previewText:
      'Мы обновили правила хранения загруженных PDF и изображений. Документы остаются доступны в личном кабинете в соответствии с регламентом.',
    recipients: [
      'client-211@example.com',
      'client-212@example.com',
      'client-213@example.com',
      'client-214@example.com',
      'client-215@example.com',
      'client-216@example.com',
    ],
  },
  {
    id: 'newsletter-010',
    subject: 'Подборка частых вопросов по заявкам',
    sentAt: '2026-03-31T13:30:00.000Z',
    recipientCount: 419,
    status: 'scheduled',
    previewText:
      'Собрали ответы на частые вопросы о сроках рассмотрения, форматах документов, оплате и получении результата оценки.',
    recipients: [
      'client-301@example.com',
      'client-302@example.com',
      'client-303@example.com',
      'client-304@example.com',
      'client-305@example.com',
      'client-306@example.com',
    ],
  },
  {
    id: 'newsletter-011',
    subject: 'Черновик: повторная активация подписчиков',
    sentAt: '2026-03-27T09:00:00.000Z',
    recipientCount: 0,
    status: 'draft',
    previewText:
      'Подготовьте мягкое письмо для пользователей, которые давно не заходили в личный кабинет и могут вернуться к незавершённым заявкам.',
    recipients: [],
  },
  {
    id: 'newsletter-012',
    subject: 'Безопасность аккаунта: проверьте доступы',
    sentAt: '2026-03-12T06:40:00.000Z',
    recipientCount: 895,
    status: 'sent',
    previewText:
      'Рекомендуем проверить актуальность пароля, контактного email и список активных сессий в личном кабинете.',
    recipients: [
      'client-401@example.com',
      'client-402@example.com',
      'client-403@example.com',
      'client-404@example.com',
      'client-405@example.com',
      'client-406@example.com',
    ],
  },
];

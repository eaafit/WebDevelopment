// TODO(T-C1): дублирует seed из `../RequestAssessment/requests/requests.ts`.
// Убрать при миграции на RPC (AssessmentService) — оба места перейдут на фасад.
import { AssessmentItem } from '../RequestAssessment/requests/requests';

export const ASSESSMENTS_STORAGE_KEY = 'assessments';

export const DASHBOARD_SEED: AssessmentItem[] = [
  {
    id: 'seed-001',
    userId: 'user-001',
    applicantName: 'Иванов Иван Иванович',
    status: 'New',
    address: 'г. Москва, ул. Тверская, д. 12, кв. 45',
    description: 'Оценка жилого помещения для ипотечного кредитования',
    estimatedValue: '',
    createdAt: '2024-03-01T10:00:00',
    updatedAt: '2024-03-01T10:00:00',
  },
  {
    id: 'seed-002',
    userId: 'user-002',
    applicantName: 'Петрова Мария Сергеевна',
    status: 'Verified',
    address: 'г. Санкт-Петербург, Невский пр., д. 78, кв. 3',
    description: 'Оценка коммерческой недвижимости для продажи',
    estimatedValue: '',
    createdAt: '2024-03-05T14:30:00',
    updatedAt: '2024-03-06T09:15:00',
  },
  {
    id: 'seed-003',
    userId: 'user-003',
    applicantName: 'Сидоров Алексей Петрович',
    status: 'InProgress',
    address: 'г. Казань, ул. Баумана, д. 33',
    description: 'Оценка земельного участка под строительство',
    estimatedValue: '4500000',
    createdAt: '2024-02-20T11:45:00',
    updatedAt: '2024-03-10T16:20:00',
  },
  {
    id: 'seed-004',
    userId: 'user-004',
    applicantName: 'Козлова Елена Викторовна',
    status: 'Completed',
    address: 'г. Екатеринбург, ул. Ленина, д. 5, кв. 12',
    description: 'Оценка квартиры для наследственного дела',
    estimatedValue: '3200000',
    createdAt: '2024-02-10T09:00:00',
    updatedAt: '2024-03-01T14:00:00',
  },
  {
    id: 'seed-005',
    userId: 'user-005',
    applicantName: 'Новиков Дмитрий Александрович',
    status: 'Cancelled',
    address: 'г. Новосибирск, ул. Красный пр., д. 100',
    description: 'Оценка нежилого помещения',
    estimatedValue: '',
    createdAt: '2024-02-15T16:30:00',
    updatedAt: '2024-02-18T10:00:00',
  },
  {
    id: 'seed-006',
    userId: 'user-006',
    applicantName: 'Васильева Ольга Михайловна',
    status: 'New',
    address: 'г. Нижний Новгород, ул. Горького, д. 22, кв. 8',
    description: 'Оценка жилого дома для раздела имущества',
    estimatedValue: '',
    createdAt: '2024-03-12T08:15:00',
    updatedAt: '2024-03-12T08:15:00',
  },
  {
    id: 'seed-007',
    userId: 'user-007',
    applicantName: 'Морозов Сергей Владимирович',
    status: 'InProgress',
    address: 'г. Краснодар, ул. Красная, д. 55',
    description: 'Оценка гаражного помещения',
    estimatedValue: '1800000',
    createdAt: '2024-03-08T13:00:00',
    updatedAt: '2024-03-11T11:30:00',
  },
];

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

import { ChangeDetectionStrategy, Component, Input, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItemComponent } from './history-item/history-item';
import { AssessmentOrder, OrderStatus } from './models';
import { ActivatedRoute } from '@angular/router';
import { AssessmentDetailModalComponent } from '../assessment-detail-modal';

@Component({
  selector: 'lib-assessment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoryItemComponent, AssessmentDetailModalComponent],
  templateUrl: './assessment-history.html',
  styleUrls: ['./assessment-history.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentHistoryComponent implements OnInit {
  @Input() role: 'applicant' | 'notary' = 'applicant';

  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    const routeRole = this.route.snapshot.data['role'];
    if (routeRole) {
      this.role = routeRole;
    }
  }

  // Фильтры
  searchQuery = signal('');
  statusFilter = signal<OrderStatus | 'all'>('all');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  // Доступные статусы для фильтра
  statusOptions: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все статусы' },
    { value: 'created', label: 'Создана' },
    { value: 'accepted', label: 'Принята' },
    { value: 'under_review', label: 'На рассмотрении' },
    { value: 'completed', label: 'Завершена' },
    { value: 'rejected', label: 'Отклонена' },
  ];

  // Моковые данные (в реальном проекте получать через сервис)
  protected orders = signal<AssessmentOrder[]>([
    {
      id: 'ORD-001',
      objectAddress: 'г. Москва, ул. Тверская, д. 12, кв. 45',
      orderDate: new Date('2025-03-10'),
      status: 'completed',
      totalAmount: 4500,
      statusHistory: [
        { status: 'created', date: new Date('2025-03-10'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-03-11'), comment: 'Назначен оценщик' },
        { status: 'completed', date: new Date('2025-03-15'), comment: 'Отчёт готов' },
      ],
      // Новые поля
      applicantId: 'user-001',
      applicantName: 'Иванов Иван Иванович',
      notaryId: 'notary-001',
      notaryName: 'Петрова Анна Сергеевна',
      plannedCompletionDate: new Date('2025-03-20'),
      actualCompletionDate: new Date('2025-03-15'),
      transactionId: 'txn_123456',
      realEstateObject: {
        id: 're-001',
        address: 'г. Москва, ул. Тверская, д. 12, кв. 45',
        city: 'Москва',
        area: 68.5,
        objectType: 'apartment',
        roomsCount: 3,
        floor: 5,
      },
    },
    {
      id: 'ORD-002',
      objectAddress: 'г. Санкт-Петербург, Невский пр., д. 100',
      orderDate: new Date('2025-03-20'),
      status: 'accepted',
      totalAmount: 6200,
      statusHistory: [
        { status: 'created', date: new Date('2025-03-20'), comment: 'Заказ создан' },
        { status: 'accepted', date: new Date('2025-03-22'), comment: 'Документы приняты' },
      ],
      applicantId: 'user-002',
      applicantName: 'Сидоров Пётр Алексеевич',
      notaryId: 'notary-002',
      notaryName: 'Козлова Елена Викторовна',
      plannedCompletionDate: new Date('2025-03-30'),
      transactionId: 'txn_789012',
      realEstateObject: {
        id: 're-002',
        address: 'г. Санкт-Петербург, Невский пр., д. 100',
        city: 'Санкт-Петербург',
        area: 95.0,
        objectType: 'apartment',
        roomsCount: 4,
        floor: 7,
      },
    },
    {
      id: 'ORD-003',
      objectAddress: 'г. Казань, ул. Баумана, д. 5',
      orderDate: new Date('2025-03-05'),
      status: 'rejected',
      totalAmount: 3800,
      statusHistory: [
        { status: 'created', date: new Date('2025-03-05'), comment: 'Заказ создан' },
        { status: 'rejected', date: new Date('2025-03-07'), comment: 'Недостаточно данных' },
      ],
      applicantId: 'user-003',
      applicantName: 'Михайлова Ольга Дмитриевна',
      plannedCompletionDate: new Date('2025-03-15'),
      transactionId: 'txn_345678',
      realEstateObject: {
        id: 're-003',
        address: 'г. Казань, ул. Баумана, д. 5',
        city: 'Казань',
        area: 45.0,
        objectType: 'apartment',
        roomsCount: 1,
        floor: 3,
      },
    },

    {
      id: 'ORD-004',
      objectAddress: 'г. Екатеринбург, ул. Ленина, д. 15',
      orderDate: new Date('2025-04-01'),
      status: 'created',
      totalAmount: 5100,
      statusHistory: [{ status: 'created', date: new Date('2025-04-01'), comment: 'Заказ создан' }],
      applicantId: 'user-004',
      applicantName: 'Смирнов Алексей Викторович',
      plannedCompletionDate: new Date('2025-04-20'),
      realEstateObject: {
        id: 're-004',
        address: 'г. Екатеринбург, ул. Ленина, д. 15',
        city: 'Екатеринбург',
        area: 72.0,
        objectType: 'apartment',
        roomsCount: 2,
        floor: 5,
      },
    },
    {
      id: 'ORD-005',
      objectAddress: 'г. Новосибирск, Красный пр., д. 20',
      orderDate: new Date('2025-04-10'),
      status: 'under_review',
      totalAmount: 8900,
      statusHistory: [
        { status: 'created', date: new Date('2025-04-10'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-04-12'), comment: 'Документы приняты' },
      ],
      applicantId: 'user-005',
      applicantName: 'Кузнецова Татьяна Петровна',
      notaryId: 'notary-005',
      notaryName: 'Соколов Дмитрий Иванович',
      plannedCompletionDate: new Date('2025-05-05'),
      transactionId: 'txn_987654',
      realEstateObject: {
        id: 're-005',
        address: 'г. Новосибирск, Красный пр., д. 20',
        city: 'Новосибирск',
        area: 110.0,
        objectType: 'apartment',
        roomsCount: 4,
        floor: 12,
      },
    },
    {
      id: 'ORD-006',
      objectAddress: 'г. Нижний Новгород, ул. Большая Покровская, д. 8',
      orderDate: new Date('2025-04-15'),
      status: 'completed',
      totalAmount: 4300,
      statusHistory: [
        { status: 'created', date: new Date('2025-04-15'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-04-17'), comment: 'Назначен оценщик' },
        { status: 'completed', date: new Date('2025-04-25'), comment: 'Отчёт готов' },
      ],
      applicantId: 'user-006',
      applicantName: 'Морозов Илья Сергеевич',
      notaryId: 'notary-006',
      notaryName: 'Иванова Мария Андреевна',
      plannedCompletionDate: new Date('2025-04-30'),
      actualCompletionDate: new Date('2025-04-25'),
      transactionId: 'txn_112233',
      realEstateObject: {
        id: 're-006',
        address: 'г. Нижний Новгород, ул. Большая Покровская, д. 8',
        city: 'Нижний Новгород',
        area: 85.5,
        objectType: 'apartment',
        roomsCount: 3,
        floor: 3,
      },
    },
    {
      id: 'ORD-007',
      objectAddress: 'г. Челябинск, пр. Ленина, д. 30',
      orderDate: new Date('2025-04-20'),
      status: 'created',
      totalAmount: 7200,
      statusHistory: [{ status: 'created', date: new Date('2025-04-20'), comment: 'Заказ создан' }],
      applicantId: 'user-007',
      applicantName: 'Васильева Екатерина Дмитриевна',
      plannedCompletionDate: new Date('2025-05-15'),
      realEstateObject: {
        id: 're-007',
        address: 'г. Челябинск, пр. Ленина, д. 30',
        city: 'Челябинск',
        area: 60.0,
        objectType: 'apartment',
        roomsCount: 2,
        floor: 7,
      },
    },
    {
      id: 'ORD-008',
      objectAddress: 'г. Омск, ул. Интернациональная, д. 12',
      orderDate: new Date('2025-04-25'),
      status: 'under_review',
      totalAmount: 6500,
      statusHistory: [
        { status: 'created', date: new Date('2025-04-25'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-04-27'), comment: 'Оценка начата' },
      ],
      applicantId: 'user-008',
      applicantName: 'Петров Артём Владимирович',
      notaryId: 'notary-008',
      notaryName: 'Сидорова Ольга Александровна',
      plannedCompletionDate: new Date('2025-05-20'),
      transactionId: 'txn_443322',
      realEstateObject: {
        id: 're-008',
        address: 'г. Омск, ул. Интернациональная, д. 12',
        city: 'Омск',
        area: 90.0,
        objectType: 'apartment',
        roomsCount: 3,
        floor: 9,
      },
    },
    {
      id: 'ORD-009',
      objectAddress: 'г. Ростов-на-Дону, ул. Пушкинская, д. 25',
      orderDate: new Date('2025-05-01'),
      status: 'completed',
      totalAmount: 5400,
      statusHistory: [
        { status: 'created', date: new Date('2025-05-01'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-05-03'), comment: 'Подготовка отчёта' },
        { status: 'completed', date: new Date('2025-05-10'), comment: 'Отчёт подписан' },
      ],
      applicantId: 'user-009',
      applicantName: 'Зайцева Наталья Сергеевна',
      notaryId: 'notary-009',
      notaryName: 'Кузнецов Андрей Павлович',
      plannedCompletionDate: new Date('2025-05-15'),
      actualCompletionDate: new Date('2025-05-10'),
      transactionId: 'txn_556677',
      realEstateObject: {
        id: 're-009',
        address: 'г. Ростов-на-Дону, ул. Пушкинская, д. 25',
        city: 'Ростов-на-Дону',
        area: 78.0,
        objectType: 'apartment',
        roomsCount: 2,
        floor: 4,
      },
    },
    {
      id: 'ORD-010',
      objectAddress: 'г. Самара, ул. Молодогвардейская, д. 40',
      orderDate: new Date('2025-05-05'),
      status: 'created',
      totalAmount: 4700,
      statusHistory: [{ status: 'created', date: new Date('2025-05-05'), comment: 'Заказ создан' }],
      applicantId: 'user-010',
      applicantName: 'Николаев Денис Викторович',
      plannedCompletionDate: new Date('2025-05-25'),
      realEstateObject: {
        id: 're-010',
        address: 'г. Самара, ул. Молодогвардейская, д. 40',
        city: 'Самара',
        area: 55.0,
        objectType: 'apartment',
        roomsCount: 1,
        floor: 2,
      },
    },
    {
      id: 'ORD-011',
      objectAddress: 'г. Воронеж, пр. Революции, д. 18',
      orderDate: new Date('2025-05-08'),
      status: 'under_review',
      totalAmount: 8300,
      statusHistory: [
        { status: 'created', date: new Date('2025-05-08'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-05-10'), comment: 'Сбор документов' },
      ],
      applicantId: 'user-011',
      applicantName: 'Фёдорова Анастасия Игоревна',
      notaryId: 'notary-011',
      notaryName: 'Максимов Иван Петрович',
      plannedCompletionDate: new Date('2025-06-01'),
      transactionId: 'txn_998877',
      realEstateObject: {
        id: 're-011',
        address: 'г. Воронеж, пр. Революции, д. 18',
        city: 'Воронеж',
        area: 105.0,
        objectType: 'apartment',
        roomsCount: 4,
        floor: 6,
      },
    },
    {
      id: 'ORD-012',
      objectAddress: 'г. Волгоград, ул. Мира, д. 5',
      orderDate: new Date('2025-05-12'),
      status: 'completed',
      totalAmount: 6100,
      statusHistory: [
        { status: 'created', date: new Date('2025-05-12'), comment: 'Заказ создан' },
        { status: 'under_review', date: new Date('2025-05-14'), comment: 'Оценка' },
        { status: 'completed', date: new Date('2025-05-20'), comment: 'Готово' },
      ],
      applicantId: 'user-012',
      applicantName: 'Григорьев Сергей Александрович',
      notaryId: 'notary-012',
      notaryName: 'Новикова Елена Владимировна',
      plannedCompletionDate: new Date('2025-05-25'),
      actualCompletionDate: new Date('2025-05-20'),
      transactionId: 'txn_665544',
      realEstateObject: {
        id: 're-012',
        address: 'г. Волгоград, ул. Мира, д. 5',
        city: 'Волгоград',
        area: 67.0,
        objectType: 'apartment',
        roomsCount: 2,
        floor: 3,
      },
    },
    {
      id: 'ORD-013',
      objectAddress: 'г. Пермь, ул. Ленина, д. 50',
      orderDate: new Date('2025-05-15'),
      status: 'created',
      totalAmount: 3950,
      statusHistory: [{ status: 'created', date: new Date('2025-05-15'), comment: 'Заказ создан' }],
      applicantId: 'user-013',
      applicantName: 'Алексеева Виктория Андреевна',
      plannedCompletionDate: new Date('2025-06-05'),
      realEstateObject: {
        id: 're-013',
        address: 'г. Пермь, ул. Ленина, д. 50',
        city: 'Пермь',
        area: 45.0,
        objectType: 'apartment',
        roomsCount: 1,
        floor: 1,
      },
    },
  ]);

  notifications = signal([
    {
      id: 1,
      message: 'Заявка #ORD-003 перешла в статус "Отклонена"',
      timeAgo: '2 часа назад',
      icon: '⚡',
    },
    { id: 2, message: 'Заявка #ORD-001 завершена — результат готов', timeAgo: 'вчера', icon: '⚡' },
    {
      id: 3,
      message: 'Заявка #ORD-002 перешла в статус "Принята"',
      timeAgo: '5 часов назад',
      icon: '⚡',
    },
  ]);

  // Пагинация
  pageSize = signal<number>(5);
  currentPage = signal<number>(1);

  // Модальное окно
  selectedOrderId = signal<string | null>(null);
  isModalOpen = signal<boolean>(false);

  get filteredOrders(): AssessmentOrder[] {
    const query = this.searchQuery().toLowerCase();
    const status = this.statusFilter();
    const from = this.dateFrom() ? new Date(this.dateFrom()) : null;
    const to = this.dateTo() ? new Date(this.dateTo()) : null;

    return this.orders().filter((order) => {
      // Поиск по адресу или ID
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        order.objectAddress.toLowerCase().includes(query);

      // Фильтр по статусу
      const matchesStatus = status === 'all' || order.status === status;

      // Фильтр по дате
      const orderDate = new Date(order.orderDate);
      const matchesFrom = !from || orderDate >= from;
      const matchesTo = !to || orderDate <= to;

      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }

  get totalPages(): number {
    return Math.ceil(this.filteredOrders.length / this.pageSize());
  }

  get paginatedOrders(): AssessmentOrder[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return this.filteredOrders.slice(start, end);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
    }
  }

  changePageSize(newSize: number): void {
    this.pageSize.set(newSize);
    // Сбрасываем на первую страницу, чтобы не было пустого экрана
    this.currentPage.set(1);
  }

  getSelectedOrder(): AssessmentOrder | null {
    const id = this.selectedOrderId();
    if (!id) return null;
    return this.orders().find((o) => o.id === id) ?? null;
  }

  // Действия
  repeatOrder(orderId: string): void {
    console.log(`Повтор заказа ${orderId} для роли ${this.role}`);
    // Здесь вызов сервиса для создания копии заказа
  }

  viewOrder(orderId: string): void {
    this.openModal(orderId);
  }

  openModal(orderId: string): void {
    this.selectedOrderId.set(orderId);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedOrderId.set(null);
  }
}

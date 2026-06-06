import { ChangeDetectionStrategy, Component, Input, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItemComponent } from './history-item/history-item';
import { AssessmentOrder, OrderStatus } from './models';
import { ActivatedRoute } from '@angular/router';
import { AssessmentDetailModalComponent } from '../assessment-detail-modal';
import { OrderApiService } from '../order-api.service';
// import { NotificationService } from '@internal/notification';
import { TokenStore } from '../../rpc/token-store';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Router } from '@angular/router';
import { WebLoggerService } from '../../logging/web-logger.service';

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
  private orderApi = inject(OrderApiService);
  // private notificationService = inject(NotificationService);

  private tokenStore = inject(TokenStore);
  private router = inject(Router);
  private logger = inject(WebLoggerService);

  public getCurrentUserId(): string {
    // ID пользователя из токена
    return this.tokenStore.user()?.id ?? '';
  }

  private getCurrentUserRole(): 'applicant' | 'notary' {
    // Маппим числовую роль из токена в строку для твоего компонента
    const role = this.tokenStore.role();
    if (role === 2) return 'notary';
    return 'applicant';
  }

  orders = signal<any[]>([]);
  totalPages = signal<number>(1);
  isLoading = signal<boolean>(false);

  searchQuery = signal<string>('');
  statusFilter = signal<OrderStatus | 'all'>('all');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  pageSize = signal<number>(5);
  currentPage = signal<number>(1);

  selectedOrderId = signal<string | null>(null);
  isModalOpen = signal<boolean>(false);

  notifications = signal([
    {
      id: 1,
      message: 'Заявка заказа №27730eb4-5bde-49b2-a681-c026ac8c85c7 перешла в статус "Принята"',
      timeAgo: '2 часа назад',
      icon: '⚡',
    },
    {
      id: 2,
      message: 'Заявка заказа №38f826fe-9f4c-4296-a1e7-62ae28b27fee перешла в статус "Принята"',
      timeAgo: '5 часов назад',
      icon: '⚡',
    },
    {
      id: 3,
      message: 'Заявка заказа №38f826fe-9f4c-4296-a1e7-62ae28b27fee перешла в статус "Создана"',
      timeAgo: '8 часов назад',
      icon: '⚡',
    },
  ]);

  recentEvents = signal<any[]>([]);

  statusOptions: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все статусы' },
    { value: 'created', label: 'Создана' },
    { value: 'accepted', label: 'Принята' },
    { value: 'under_review', label: 'На рассмотрении' },
    { value: 'completed', label: 'Завершена' },
    { value: 'rejected', label: 'Отклонена' },
  ];

  private formatTimeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} д назад`;
  }

  ngOnInit(): void {
    // Роль из маршрута имеет приоритет для определения контекста страницы (заявитель/нотариус)
    const routeRole = this.route.snapshot.data['role'];
    if (routeRole) {
      this.role = routeRole;
    } else {
      // Если роль не передана через маршрут, используем роль из токена
      this.role = this.getCurrentUserRole();
    }
    this.loadOrders();
    this.loadRecentEvents();
    // this.loadNotifications();
  }

  async loadOrders(): Promise<void> {
    const userId = this.getCurrentUserId();
    // console.log('Current user ID:', this.getCurrentUserId());
    this.logger.info('order.history.load_started', {
      role: this.role,
      filters: {
        status: this.statusFilter(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
        search: this.searchQuery(),
      },
    });

    this.isLoading.set(true);
    try {
      const response = await this.orderApi.listOrders({
        userId,
        role: this.role,
        status: this.statusFilter() !== 'all' ? this.statusFilter() : undefined,
        search: this.searchQuery() || undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        page: this.currentPage(),
        pageSize: this.pageSize(),
      });

      this.orders.set(response.orders);
      this.totalPages.set(response.totalPages);
      this.logger.info('order.history.load_succeeded', {
        ordersCount: response.orders.length,
        total: response.totalCount,
      });
    } catch (err) {
      this.logger.error('order.history.load_failed', { error: err });
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadRecentEvents(): Promise<void> {
    const userId = this.getCurrentUserId();
    const role = this.role;
    try {
      const events = await this.orderApi.getRecentEvents(userId, role, 3);
      this.recentEvents.set(events);
    } catch (err) {
      this.logger.error('Failed to load recent events: ', { error: err });
    }
  }

  eventIcon(type: string): string {
    if (type === 'order.created') return '📄';
    if (type === 'order.taken') return '👨‍⚖️';
    if (type === 'order.completed') return '✅';
    return '📌';
  }

  formatEventText(event: any): string {
    const shortId = event.orderId ? event.orderId.slice(0, 8) : '';
    const address = event.orderAddress ? event.orderAddress.slice(0, 40) : '';
    const prefix = shortId ? `Заказ №${shortId}: ` : '';
    if (event.eventType === 'order.created') {
      return `${prefix}Создан заказ: ${address}`;
    }
    if (event.eventType === 'order.taken') {
      return `${prefix}Заказ взят в работу: ${address}`;
    }
    if (event.eventType === 'order.completed') {
      return `${prefix}Заказ завершён: ${address}`;
    }
    return `${prefix}Изменение заказа: ${address}`;
  }

  formatEventDate(date: any): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'object' && 'seconds' in date) {
      return new Date(Number(date.seconds) * 1000);
    }
    return null;
  }
  // private async loadNotifications(): Promise<void> {
  //   const userId = 'current-user-id'; // замените на реальный ID
  //   try {
  //     const response = await this.notificationService.listNotifications({ userId } as any);
  //     const formatted = response.notifications.map((n: any) => ({
  //       id: n.id,
  //       message: n.message,
  //       timeAgo: this.formatTimeAgo(new Date(n.createdAt)),
  //       icon: '⚡',
  //     }));
  //     this.notifications.set(formatted);
  //   } catch (err) {
  //     console.error('Ошибка загрузки уведомлений:', err);
  //     this.notifications.set([]);
  //   }
  // }

  onSearchChange(): void {
    this.logger.info('order.history.filter.search_changed', { search: this.searchQuery() });
    this.currentPage.set(1);
    this.loadOrders();
  }
  onStatusChange(): void {
    this.logger.info('order.history.filter.status_changed', { status: this.statusFilter() });
    this.currentPage.set(1);
    this.loadOrders();
  }
  onDateFromChange(): void {
    this.logger.info('order.history.filter.date_from_changed', { dateFrom: this.dateFrom() });
    this.currentPage.set(1);
    this.loadOrders();
  }
  onDateToChange(): void {
    this.logger.info('order.history.filter.date_to_changed', { dateTo: this.dateTo() });
    this.currentPage.set(1);
    this.loadOrders();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.logger.info('order.history.pagination.page_changed', { page });
      this.loadOrders();
    }
  }

  changePageSize(newSize: string | number): void {
    const size = typeof newSize === 'string' ? parseInt(newSize, 10) : newSize;
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.logger.info('order.history.pagination.page_size_changed', { newSize: size });
    this.loadOrders();
  }

  getSelectedOrder(): any {
    const id = this.selectedOrderId();
    if (!id) return null;
    const order = this.orders().find((o) => o.id === id);
    if (!order) return null;

    // Преобразуем Timestamp → Date для основных полей и для истории статусов
    return {
      ...order,
      orderDate: order.orderDate ? timestampDate(order.orderDate) : null,
      plannedCompletionDate: order.plannedCompletionDate
        ? timestampDate(order.plannedCompletionDate)
        : null,
      actualCompletionDate: order.actualCompletionDate
        ? timestampDate(order.actualCompletionDate)
        : null,
      statusHistory:
        order.statusHistory?.map((entry: any) => ({
          ...entry,
          date: entry.date ? timestampDate(entry.date) : null,
        })) || [],
    };
  }

  async repeatOrder(orderId: string): Promise<void> {
    // Найти заказ в текущем списке
    const order = this.orders().find((o) => o.id === orderId);
    this.logger.info('order.history.repeat_order', { orderId });
    if (!order) {
      this.logger.error('order.history.repeat_order_failed', {
        orderId,
        reason: 'Order not found',
      });
      return;
    }

    // Собрать данные для формы из полей заказа
    const formData = {
      fiasObjectId: '',
      fiasObjectGuid: '',
      cityId: '',
      districtId: '',
      address: order.objectAddress,
      cadastralNumber: '',
      area: order.realEstateObject?.area?.toString() || '',
      objectType: order.realEstateObject?.objectType
        ? String(order.realEstateObject.objectType)
        : '',
      rooms: order.realEstateObject?.roomsCount?.toString() || '',
      floorsTotal: '',
      floor: order.realEstateObject?.floor?.toString() || '',
      condition: '',
      yearBuilt: '',
      wallMaterial: '',
      elevatorType: '',
      hasBalconyOrLoggia: false,
      landCategory: '',
      permittedUse: '',
      utilities: '',
      description: '',
    };

    // Перейти на страницу новой заявки и передать данные
    this.router.navigate(['/applicant/assessment/new/params'], {
      state: { repeatOrderData: formData },
    });
  }

  viewOrder(orderId: string): void {
    this.openModal(orderId);
  }

  openModal(orderId: string): void {
    this.selectedOrderId.set(orderId);
    this.logger.info('order.history.modal.opened', { orderId });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedOrderId.set(null);
  }

  refresh(): void {
    this.currentPage.set(1);
    this.loadOrders();
    this.loadRecentEvents();
  }
}

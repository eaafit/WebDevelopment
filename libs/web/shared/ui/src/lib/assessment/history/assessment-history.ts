import { ChangeDetectionStrategy, Component, Input, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItemComponent } from './history-item/history-item';
import { AssessmentOrder, OrderStatus } from './models';
import { ActivatedRoute } from '@angular/router';
import { AssessmentDetailModalComponent } from '../assessment-detail-modal';
import { OrderApiService } from '../order-api.service';
// import { NotificationService } from '@internal/notification';
import { TokenStore } from '@notary-portal/ui';

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

  private getCurrentUserId(): string {
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


  notifications = signal<any[]>([]);
  // notifications = signal([
  //   { id: 1, message: 'Заявка #ORD-003 перешла в статус "Отклонена"', timeAgo: '2 часа назад', icon: '⚡' },
  //   { id: 2, message: 'Заявка #ORD-001 завершена — результат готов', timeAgo: 'вчера', icon: '⚡' },
  //   { id: 3, message: 'Заявка #ORD-002 перешла в статус "Принята"', timeAgo: '5 часов назад', icon: '⚡' },
  // ]);

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
    // this.loadNotifications();
  }

  async loadOrders(): Promise<void> {
    const userId = this.getCurrentUserId();
    console.log('Current user ID:', this.getCurrentUserId());
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
    } catch (err) {
      console.error('Ошибка загрузки заказов:', err);
    } finally {
      this.isLoading.set(false);
    }
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



  onSearchChange(): void { this.currentPage.set(1); this.loadOrders(); }
  onStatusChange(): void { this.currentPage.set(1); this.loadOrders(); }
  onDateFromChange(): void { this.currentPage.set(1); this.loadOrders(); }
  onDateToChange(): void { this.currentPage.set(1); this.loadOrders(); }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadOrders();
    }
  }

  changePageSize(newSize: number): void {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadOrders();
  }

  getSelectedOrder(): AssessmentOrder | null {
    const id = this.selectedOrderId();
    return id ? this.orders().find(o => o.id === id) ?? null : null;
  }

  repeatOrder(orderId: string): void {
    console.log(`Повтор заказа ${orderId} для роли ${this.role}`);
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
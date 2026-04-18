import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItemComponent } from './history-item/history-item';
import { AssessmentOrder, OrderStatus } from './models';

@Component({
  selector: 'lib-assessment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoryItemComponent],
  templateUrl: './assessment-history.html',
  styleUrls: ['./assessment-history.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentHistoryComponent {
  @Input() role: 'applicant' | 'notary' = 'applicant';

  // Фильтры
  searchQuery = signal('');
  statusFilter = signal<OrderStatus | 'all'>('all');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  // Доступные статусы для фильтра
  statusOptions: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидает' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Завершён' },
    { value: 'failed', label: 'Ошибка' },
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
        { status: 'pending', date: new Date('2025-03-10'), comment: 'Заказ создан' },
        { status: 'in_progress', date: new Date('2025-03-11'), comment: 'Назначен оценщик' },
        { status: 'completed', date: new Date('2025-03-15'), comment: 'Отчёт готов' },
      ],
    },
    {
      id: 'ORD-002',
      objectAddress: 'г. Санкт-Петербург, Невский пр., д. 100',
      orderDate: new Date('2025-03-20'),
      status: 'in_progress',
      totalAmount: 6200,
      statusHistory: [
        { status: 'pending', date: new Date('2025-03-20'), comment: 'Заказ создан' },
        { status: 'in_progress', date: new Date('2025-03-22'), comment: 'Документы приняты' },
      ],
    },
    {
      id: 'ORD-003',
      objectAddress: 'г. Казань, ул. Баумана, д. 5',
      orderDate: new Date('2025-03-05'),
      status: 'failed',
      totalAmount: 3800,
      statusHistory: [
        { status: 'pending', date: new Date('2025-03-05'), comment: 'Заказ создан' },
        { status: 'failed', date: new Date('2025-03-07'), comment: 'Недостаточно данных' },
      ],
    },
  ]);

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

  // Действия
  repeatOrder(orderId: string): void {
    console.log(`Повтор заказа ${orderId} для роли ${this.role}`);
    // Здесь вызов сервиса для создания копии заказа
  }

  viewOrder(orderId: string): void {
    console.log(`Просмотр заказа ${orderId}`);
    // Навигация на детальную страницу
  }
}

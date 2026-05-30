import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Order {
  id: number;
  address: string;
  addressHint: string;
  propertyType: string;
  area: number;
  applicant: string;
  status: string;
  date: string;
}

@Component({
  selector: 'lib-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class Assessment {
  editingOrderId = signal<number | null>(null);

  orders = signal<Order[]>([
    {
      id: 1,
      address: 'г. Москва, ул. Тверская, 15-45',
      addressHint: '3-комнатная, 5 этаж',
      propertyType: 'Квартира',
      area: 68.5,
      applicant: 'Иванов И.И.',
      status: 'new',
      date: '15.03.2024',
    },
    {
      id: 2,
      address: 'г. Екатеринбург, ул. Ленина, 10',
      addressHint: '5-комнатный дом, 1 этаж',
      propertyType: 'Дом',
      area: 220.0,
      applicant: 'Петров П.П.',
      status: 'progress',
      date: '10.03.2024',
    },
    {
      id: 3,
      address: 'г. Санкт-Петербург, Невский пр., 100',
      addressHint: 'коммерческое помещение',
      propertyType: 'Коммерческая',
      area: 150.0,
      applicant: 'Сидоров С.С.',
      status: 'success',
      date: '01.03.2024',
    },
    {
      id: 4,
      address: 'г. Новосибирск, Красный пр., 50',
      addressHint: '2-комнатная, 3 этаж',
      propertyType: 'Квартира',
      area: 45.2,
      applicant: 'Кузнецова А.В.',
      status: 'rejected',
      date: '28.02.2024',
    },
  ]);

  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');

  statuses = [
    { value: 'all', label: 'Все' },
    { value: 'new', label: 'Новая' },
    { value: 'progress', label: 'В работе' },
    { value: 'success', label: 'Принято' },
    { value: 'rejected', label: 'Отклонено' },
  ];

  statusOptions = [
    { value: 'new', label: 'Новая' },
    { value: 'progress', label: 'В работе' },
    { value: 'success', label: 'Принято' },
    { value: 'rejected', label: 'Отклонено' },
  ];

  get filteredOrders(): Order[] {
    let result = this.orders();

    if (this.statusFilter() !== 'all') {
      result = result.filter((order) => order.status === this.statusFilter());
    }

    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      result = result.filter(
        (order) =>
          order.address.toLowerCase().includes(query) ||
          order.propertyType.toLowerCase().includes(query) ||
          order.applicant.toLowerCase().includes(query),
      );
    }

    return result;
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  startEditing(orderId: number): void {
    this.editingOrderId.set(orderId);
  }

  cancelEditing(): void {
    this.editingOrderId.set(null);
  }

  updateStatus(orderId: number, newStatus: string): void {
    this.orders.update((orders) =>
      orders.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)),
    );
    this.editingOrderId.set(null);
    console.log(`Заказ ${orderId}: статус изменён на ${newStatus}`);
    // TODO: отправить на сервер
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      new: 'status-new',
      progress: 'status-progress',
      success: 'status-success',
      rejected: 'status-rejected',
    };
    return classes[status] || 'status-new';
  }

  getStatusText(status: string): string {
    const texts: Record<string, string> = {
      new: 'Новая',
      progress: 'В работе',
      success: 'Принято',
      rejected: 'Отклонено',
    };
    return texts[status] || status;
  }

  viewOrder(id: number): void {
    console.log('Просмотр заказа:', id);
  }
}

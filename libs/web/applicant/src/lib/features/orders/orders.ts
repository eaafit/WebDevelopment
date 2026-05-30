import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Order {
  id: number;
  address: string;
  addressHint: string;
  propertyType: string;
  area: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'lib-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class Orders {
  orders = signal<Order[]>([
    {
      id: 1,
      address: 'г. Москва, ул. Тверская, 15-45',
      addressHint: '3-комнатная, 5 этаж',
      propertyType: 'Квартира',
      area: 68.5,
      status: 'new',
      createdAt: '15.03.2024',
      updatedAt: '15.03.2024',
    },
    {
      id: 2,
      address: 'г. Екатеринбург, ул. Ленина, 10',
      addressHint: '5-комнатный дом, 1 этаж',
      propertyType: 'Дом',
      area: 220.0,
      status: 'draft',
      createdAt: '16.03.2024',
      updatedAt: '16.03.2024',
    },
    {
      id: 3,
      address: 'г. Санкт-Петербург, Невский пр., 100',
      addressHint: 'коммерческое помещение, 1 этаж',
      propertyType: 'Коммерческая',
      area: 150.0,
      status: 'progress',
      createdAt: '10.03.2024',
      updatedAt: '12.03.2024',
    },
    {
      id: 4,
      address: 'г. Казань, ул. Баумана, 25',
      addressHint: '2-этажный дом, 185 м²',
      propertyType: 'Дом',
      area: 185.0,
      status: 'completed',
      createdAt: '01.03.2024',
      updatedAt: '08.03.2024',
    },
    {
      id: 5,
      address: 'г. Новосибирск, Красный пр., 50',
      addressHint: '2-комнатная, 3 этаж',
      propertyType: 'Квартира',
      area: 45.2,
      status: 'rejected',
      createdAt: '28.02.2024',
      updatedAt: '05.03.2024',
    },
  ]);

  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');

  statuses = [
    { value: 'all', label: 'Все' },
    { value: 'draft', label: 'Черновик' },
    { value: 'new', label: 'Новая' },
    { value: 'progress', label: 'В работе' },
    { value: 'completed', label: 'Завершена' },
    { value: 'rejected', label: 'Отклонена' },
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
          order.propertyType.toLowerCase().includes(query),
      );
    }

    result.sort((a, b) => {
      const [ad, am, ay] = a.createdAt.split('.');
      const [bd, bm, by] = b.createdAt.split('.');
      return new Date(`${ay}-${am}-${ad}`).getTime() > new Date(`${by}-${bm}-${bd}`).getTime()
        ? -1
        : 1;
    });

    return result;
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      new: 'status-new',
      progress: 'status-progress',
      completed: 'status-success',
      rejected: 'status-rejected',
    };
    return classes[status] || 'status-new';
  }

  getStatusText(status: string): string {
    const texts: Record<string, string> = {
      draft: 'Черновик',
      new: 'Новая',
      progress: 'В работе',
      completed: 'Завершена',
      rejected: 'Отклонена',
    };
    return texts[status] || status;
  }

  canEdit(status: string): boolean {
    return status === 'draft' || status === 'new';
  }

  canDelete(status: string): boolean {
    return status === 'draft';
  }

  viewOrder(id: number): void {
    console.log('Просмотр заказа:', id);
  }

  editOrder(id: number): void {
    console.log('Редактирование заказа:', id);
  }

  deleteOrder(id: number): void {
    if (confirm('Вы уверены, что хотите удалить этот черновик?')) {
      const updated = this.orders().filter((order) => order.id !== id);
      this.orders.set(updated);
      console.log('Удалён заказ:', id);
    }
  }

  createOrder(): void {
    console.log('Создать заявку');
  }
}

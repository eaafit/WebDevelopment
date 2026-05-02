import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Order {
  id: string;
  date: string;
  clientName: string;
  object: string;
  status: string;
}

@Component({
  selector: 'lib-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  activeOrdersCount = 3;
  notificationsCount = 2;

  recentOrders: Order[] = [
    { id: '1', date: '01.05.2026', clientName: 'Иванов И.И.', object: 'Квартира, 45 м²', status: 'В работе' },
    { id: '2', date: '30.04.2026', clientName: 'Петрова А.С.', object: 'Земельный участок', status: 'Завершён' },
    { id: '3', date: '28.04.2026', clientName: 'Сидоров В.П.', object: 'Гараж', status: 'Ожидает оплаты' },
  ];

  getStatusClass(status: string): string {
    switch (status) {
      case 'В работе': return 'badge badge-pending';
      case 'Завершён': return 'badge badge-success';
      case 'Ожидает оплаты': return 'badge badge-warning';
      default: return 'badge';
    }
  }
}
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

interface AssessmentItem {
  id: string;
  userId: string;
  applicantName: string;
  status: string;
  address: string;
  description: string;
  estimatedValue: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Мок-данные (синхронизированы с assessment.ts)
const MOCK_ASSESSMENTS: AssessmentItem[] = [
  { id: 'ast-001', userId: 'user-1', applicantName: 'Иванов Иван Иванович', status: 'InProgress', address: 'г. Москва, ул. Тверская, д. 15, кв. 45', description: '3-комнатная квартира, 5 этаж', estimatedValue: '', createdAt: '2026-06-01T10:00:00Z', updatedAt: '2026-06-01T10:00:00Z' },
  { id: 'ast-002', userId: 'user-2', applicantName: 'Петрова Мария Сергеевна', status: 'Verified', address: 'г. Санкт-Петербург, Невский пр., д. 100', description: 'Коммерческое помещение, 150 м²', estimatedValue: '', createdAt: '2026-06-02T11:30:00Z', updatedAt: '2026-06-03T09:00:00Z' },
  { id: 'ast-003', userId: 'user-3', applicantName: 'Сидоров Алексей Викторович', status: 'Completed', address: 'г. Екатеринбург, ул. Ленина, д. 10', description: '5-комнатный дом, 220 м²', estimatedValue: '8500000', createdAt: '2026-05-28T14:20:00Z', updatedAt: '2026-06-02T16:45:00Z' },
  { id: 'ast-004', userId: 'user-4', applicantName: 'Кузнецова Анна Владимировна', status: 'Verified', address: 'г. Казань, ул. Баумана, д. 25', description: '2-этажный дом, 185 м²', estimatedValue: '', createdAt: '2026-05-20T09:15:00Z', updatedAt: '2026-05-30T11:00:00Z' },
  { id: 'ast-005', userId: 'user-5', applicantName: 'Михайлов Дмитрий Андреевич', status: 'Cancelled', address: 'г. Новосибирск, Красный пр., д. 50', description: '2-комнатная квартира, 45.2 м²', estimatedValue: '', cancelReason: 'Заявитель передумал', createdAt: '2026-05-15T08:00:00Z', updatedAt: '2026-05-25T12:30:00Z' },
  { id: 'ast-006', userId: 'user-6', applicantName: 'Соколова Елена Дмитриевна', status: 'New', address: 'г. Краснодар, ул. Красная, д. 20', description: '1-комнатная квартира', estimatedValue: '', createdAt: '2026-06-04T09:00:00Z', updatedAt: '2026-06-04T09:00:00Z' },
  { id: 'ast-007', userId: 'user-7', applicantName: 'Морозов Андрей Сергеевич', status: 'InProgress', address: 'г. Сочи, ул. Навагинская, д. 5', description: 'Таунхаус, 120 м²', estimatedValue: '', createdAt: '2026-06-05T14:00:00Z', updatedAt: '2026-06-06T10:00:00Z' },
  { id: 'ast-008', userId: 'user-8', applicantName: 'Волкова Татьяна Павловна', status: 'Completed', address: 'г. Нижний Новгород, ул. Большая Покровская, д. 30', description: 'Офисное помещение, 80 м²', estimatedValue: '4200000', createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-04T15:00:00Z' },
  { id: 'ast-009', userId: 'user-9', applicantName: 'Зайцев Константин Игоревич', status: 'Verified', address: 'г. Ростов-на-Дону, пр. Будённовский, д. 45', description: '3-комнатная квартира', estimatedValue: '', createdAt: '2026-05-30T12:00:00Z', updatedAt: '2026-06-05T11:00:00Z' },
  { id: 'ast-010', userId: 'user-10', applicantName: 'Николаева Ольга Владимировна', status: 'Cancelled', address: 'г. Самара, ул. Ленинградская, д. 12', description: 'Земельный участок', estimatedValue: '', cancelReason: 'Не сошлись в цене', createdAt: '2026-05-25T10:00:00Z', updatedAt: '2026-06-03T09:00:00Z' },
  { id: 'ast-011', userId: 'user-11', applicantName: 'Павлов Сергей Николаевич', status: 'New', address: 'г. Уфа, пр. Октября, д. 88', description: 'Склад 500 м²', estimatedValue: '', createdAt: '2026-05-22T16:00:00Z', updatedAt: '2026-06-01T14:00:00Z' },
  { id: 'ast-012', userId: 'user-12', applicantName: 'Егорова Анастасия Дмитриевна', status: 'InProgress', address: 'г. Воронеж, ул. Плехановская, д. 7', description: '2-комнатная квартира', estimatedValue: '', createdAt: '2026-05-18T11:00:00Z', updatedAt: '2026-05-28T09:00:00Z' },
  { id: 'ast-013', userId: 'user-13', applicantName: 'Тимофеев Алексей Петрович', status: 'Completed', address: 'г. Волгоград, ул. Мира, д. 15', description: 'Частный дом, 150 м²', estimatedValue: '12500000', createdAt: '2026-06-06T09:00:00Z', updatedAt: '2026-06-06T09:00:00Z' },
  { id: 'ast-014', userId: 'user-14', applicantName: 'Фёдорова Мария Игоревна', status: 'Verified', address: 'г. Челябинск, ул. Кирова, д. 22', description: '3-комнатная квартира', estimatedValue: '', createdAt: '2026-06-07T13:00:00Z', updatedAt: '2026-06-08T10:00:00Z' },
  { id: 'ast-015', userId: 'user-1', applicantName: 'Иванов Иван Иванович', status: 'New', address: 'г. Москва, ул. Арбат, д. 12, кв. 8', description: '2-комнатная квартира, центр', estimatedValue: '', createdAt: '2026-06-03T13:00:00Z', updatedAt: '2026-06-03T13:00:00Z' },
];

@Component({
  selector: 'lib-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="order-detail-container">
      <button class="back-btn" routerLink="/notary/orders">← Назад к списку</button>
      
      @if (order) {
        <div class="detail-card">
          <div class="detail-card__header">
            <h3>Карточка заявки</h3>
          </div>
          <div class="detail-card__body">
            <div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value">{{ order.id }}</span></div>
            <div class="detail-row"><span class="detail-label">Заявитель:</span><span class="detail-value">{{ order.applicantName }}</span></div>
            <div class="detail-row"><span class="detail-label">ID пользователя:</span><span class="detail-value">{{ order.userId }}</span></div>
            <div class="detail-row"><span class="detail-label">Адрес объекта:</span><span class="detail-value">{{ order.address }}</span></div>
            <div class="detail-row"><span class="detail-label">Описание:</span><span class="detail-value">{{ order.description || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">Статус:</span><span class="detail-value"><span class="badge" [ngClass]="getBadgeClass(order.status)">{{ getStatusLabel(order.status) }}</span></span></div>
            <div class="detail-row"><span class="detail-label">Причина отмены:</span><span class="detail-value">{{ order.cancelReason || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">Оценочная стоимость:</span><span class="detail-value">{{ formatValue(order.estimatedValue) }}</span></div>
            <div class="detail-row"><span class="detail-label">Дата создания:</span><span class="detail-value">{{ formatDate(order.createdAt) }}</span></div>
            <div class="detail-row"><span class="detail-label">Последнее обновление:</span><span class="detail-value">{{ formatDate(order.updatedAt) }}</span></div>
          </div>
        </div>
      } @else {
        <div class="not-found">
          <h3>Заявка не найдена</h3>
          <p>Заявка с ID {{ orderId }} не существует</p>
          <a routerLink="/notary/orders">Вернуться к списку</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .order-detail-container { padding: 2rem; max-width: 800px; margin: 0 auto; }
    .back-btn { margin-bottom: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; }
    .detail-card { border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; overflow: hidden; }
    .detail-card__header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .detail-card__header h3 { margin: 0; }
    .detail-card__body { padding: 1.5rem; }
    .detail-row { display: flex; margin-bottom: 0.75rem; }
    .detail-label { width: 160px; font-weight: 500; color: #6b7280; }
    .detail-value { flex: 1; color: #111827; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #b91c1c; }
    .badge-info { background: #e0e7ff; color: #3730a3; }
    .badge-primary { background: #eff6ff; color: #1d4ed8; }
    .not-found { text-align: center; padding: 3rem; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; }
    .not-found a { color: #4f46e5; text-decoration: none; }
  `]
})
export class OrderDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);

  order: AssessmentItem | null = null;
  orderId = '';

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id') || '';
    this.order = MOCK_ASSESSMENTS.find(a => a.id === this.orderId) || null;
    console.log('OrderDetail loaded, id:', this.orderId, 'order:', this.order);
  }
  
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { New: 'Новая', Verified: 'Подтверждена', InProgress: 'В работе', Completed: 'Завершена', Cancelled: 'Отменена' };
    return labels[status] || status;
  }
  
  getBadgeClass(status: string): string {
    const classes: Record<string, string> = { New: 'badge-primary', Verified: 'badge-info', InProgress: 'badge-warning', Completed: 'badge-success', Cancelled: 'badge-danger' };
    return classes[status] || 'badge-primary';
  }
  
  formatValue(value: string): string {
    if (!value) return 'Не определена';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(parseFloat(value));
  }
  
  formatDate(dateString: string): string {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
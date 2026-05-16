import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentStatus, PaymentType } from '@notary-portal/api-contracts';
import { AdminPaymentItem } from '../../../api/admin-payments-api.service';
import { PaymentDeleteModalComponent } from '../payment-delete-modal.component';

@Component({
  selector: 'lib-payment-detail-panel',
  standalone: true,
  imports: [CommonModule, PaymentDeleteModalComponent],
  template: `
    <div
      class="modal show"
      (click)="onModalBackdropClick($event)"
      (keydown)="onBackdropKeyDown($event)"
      role="button"
      tabindex="0"
      aria-label="Закрыть модальное окно">
      <div class="modal-content view-modal">
        <div class="modal-header">
          <h3>Детали платежа #{{ payment.id }}</h3>
          <button type="button" class="close-btn" (click)="closePanel()">&times;</button>
        </div>
        <div class="modal-body view-details">
          <p><strong>ID:</strong> {{ payment.id }}</p>
          <p><strong>Пользователь (ID):</strong> {{ payment.userId }}</p>
          <p><strong>Тип:</strong> {{ getTypeLabel(payment.type) }}</p>
          <p><strong>Сумма:</strong> {{ formatAmount(payment.amount) }}</p>
          <p><strong>Дата платежа:</strong> {{ formatDate(payment.paymentDate) }}</p>
          <p><strong>ID транзакции:</strong> {{ payment.transactionId || '—' }}</p>
          <p><strong>ID подписки:</strong> {{ payment.subscriptionId || '—' }}</p>
          <p><strong>ID заявки:</strong> {{ payment.assessmentId || '—' }}</p>
          
          @if (payment.attachmentFileUrl) {
          <p>
            <strong>Чек:</strong>
            <a [href]="payment.attachmentFileUrl" target="_blank" class="receipt-link">
              <i class="las la-file-alt"></i> {{ payment.attachmentFileName || 'Открыть файл' }}
            </a>
          </p>
          }
          
          <p>
            <strong>Статус:</strong>
            <span class="status-badge" [ngClass]="getStatusClass(payment.status)">
              {{ getStatusLabel(payment.status) }}
            </span>
          </p>
        </div>
        <div class="modal-footer" style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary" (click)="editPayment()">Редактировать</button>
          <button type="button" class="btn btn-danger" style="background: #ef4444; color: white;" (click)="deletePayment()">Удалить</button>
          <button type="button" class="btn btn-primary" (click)="closePanel()">Закрыть</button>
        </div>
      </div>
    </div>

    @if (showDeleteModal) {
      <lib-payment-delete-modal
        [payment]="payment"
        (confirmed)="onDeleteConfirmed()"
        (cancelled)="showDeleteModal = false">
      </lib-payment-delete-modal>
    }
  `,
  styleUrl: '../payments.scss'
})
export class PaymentDetailPanelComponent {
  @Input() payment!: AdminPaymentItem;
  @Output() close = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();

  private readonly router = inject(Router);

  showDeleteModal = false;

  closePanel(): void {
    this.close.emit();
  }

  editPayment(): void {
    this.router.navigate(['/admin', 'payments', this.payment.id, 'edit']);
  }

  deletePayment(): void {
    this.showDeleteModal = true;
  }

  onDeleteConfirmed(): void {
    this.showDeleteModal = false;
    this.deleted.emit(this.payment.id);
  }

  onModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closePanel();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onBackdropKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.showDeleteModal) {
      this.closePanel();
    }
  }

  formatAmount(amount: number): string {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  }

  getStatusLabel(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      [PaymentStatus.UNSPECIFIED]: 'Неизвестно',
      [PaymentStatus.PENDING]: 'Ожидает',
      [PaymentStatus.COMPLETED]: 'Завершён',
      [PaymentStatus.FAILED]: 'Ошибка',
      [PaymentStatus.REFUNDED]: 'Возврат'
    };
    return map[status] || 'Неизвестно';
  }

  getStatusClass(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      [PaymentStatus.UNSPECIFIED]: '',
      [PaymentStatus.PENDING]: 'status-pending',
      [PaymentStatus.COMPLETED]: 'status-completed',
      [PaymentStatus.FAILED]: 'status-failed',
      [PaymentStatus.REFUNDED]: 'status-refunded'
    };
    return map[status] || '';
  }

  getTypeLabel(type: PaymentType): string {
    const map: Record<PaymentType, string> = {
      [PaymentType.UNSPECIFIED]: 'Неизвестно',
      [PaymentType.SUBSCRIPTION]: 'Подписка',
      [PaymentType.ASSESSMENT]: 'Оценка',
      [PaymentType.DOCUMENT_COPY]: 'Копия документа'
    };
    return map[type] || 'Неизвестно';
  }
}
 

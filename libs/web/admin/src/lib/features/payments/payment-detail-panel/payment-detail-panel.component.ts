import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
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
    <div class="panel-backdrop" *ngIf="payment" (click)="close.emit()">
      <div class="panel" (click)="$event.stopPropagation()">
        <div class="panel-header">
          <h2>Детали платежа</h2>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <div class="panel-body">
          <div class="detail-row">
            <span class="label">ID системы</span>
            <span class="value">{{ payment.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Транзакция</span>
            <span class="value">{{ payment.transactionId || '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Пользователь</span>
            <span class="value">{{ payment.userId }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Сумма</span>
            <span class="value">{{ formatAmount(payment.amount) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Дата</span>
            <span class="value">{{ formatDate(payment.paymentDate) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Статус</span>
            <span class="value status-badge" [ngClass]="getStatusClass(payment.status)">
              {{ getStatusLabel(payment.status) }}
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Тип</span>
            <span class="value">{{ getTypeLabel(payment.type) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Метод оплаты</span>
            <span class="value">{{ payment.paymentMethod || '—' }}</span>
          </div>
          <div class="detail-row" *ngIf="payment.subscriptionId">
            <span class="label">Подписка</span>
            <span class="value">{{ payment.subscriptionId }}</span>
          </div>
          <div class="detail-row" *ngIf="payment.assessmentId">
            <span class="label">Оценка</span>
            <span class="value">{{ payment.assessmentId }}</span>
          </div>
          <div class="detail-row" *ngIf="payment.attachmentFileUrl">
            <span class="label">Вложение</span>
            <span class="value">
              <a [href]="payment.attachmentFileUrl" target="_blank">{{ payment.attachmentFileName || 'Скачать' }}</a>
            </span>
          </div>
        </div>

        <div class="panel-footer">
          <button class="btn btn-primary" (click)="edit()">Редактировать</button>
          <button class="btn btn-danger" (click)="promptDelete()">Удалить</button>
        </div>
      </div>
    </div>

    <lib-payment-delete-modal
      *ngIf="showDeleteModal"
      [payment]="paymentToDelete"
      (cancelled)="showDeleteModal = false"
      (confirmed)="onDeleteConfirmed()"
    ></lib-payment-delete-modal>
  `,
  styles: [
    `
      .panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        justify-content: flex-end;
        z-index: 1000;
      }
      .panel {
        width: 400px;
        background: #fff;
        height: 100%;
        display: flex;
        flex-direction: column;
        box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .panel-header {
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .panel-header h2 { margin: 0; font-size: 1.25rem; }
      .close-btn {
        background: none; border: none; font-size: 1.5rem; cursor: pointer;
        color: #64748b;
      }
      .panel-body {
        padding: 20px;
        flex: 1;
        overflow-y: auto;
      }
      .detail-row {
        margin-bottom: 15px;
        display: flex;
        flex-direction: column;
      }
      .detail-row .label { font-size: 0.875rem; color: #64748b; margin-bottom: 4px; }
      .detail-row .value { font-size: 1rem; color: #1e293b; word-break: break-all; }
      .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 500;
      }
      .status-pending { background: #fef08a; color: #854d0e; }
      .status-completed { background: #bbf7d0; color: #166534; }
      .status-failed { background: #fecaca; color: #991b1b; }
      .status-refunded { background: #e2e8f0; color: #334155; }
      .panel-footer {
        padding: 20px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 10px;
      }
      .btn {
        flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;
      }
      .btn-primary { background: #3b82f6; color: #fff; }
      .btn-danger { background: #ef4444; color: #fff; }
    `
  ]
})
export class PaymentDetailPanelComponent {
  @Input() payment: AdminPaymentItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();

  showDeleteModal = false;
  paymentToDelete: any = null;

  private router = inject(Router);

  formatAmount(amount: number): string {
    return amount.toLocaleString('ru-RU') + ' ₽';
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

  edit(): void {
    if (this.payment) {
      this.router.navigate(['/admin/payments', this.payment.id, 'edit']);
    }
  }

  promptDelete(): void {
    if (this.payment) {
      this.paymentToDelete = {
        id: this.payment.id,
        transactionId: this.payment.transactionId,
        payer: this.payment.userId,
        amount: this.payment.amount
      };
      this.showDeleteModal = true;
    }
  }

  onDeleteConfirmed(): void {
    if (this.payment) {
      this.deleted.emit(this.payment.id);
      this.showDeleteModal = false;
      this.close.emit();
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PaymentItem {
  id: string | number;
  transactionId?: string;
  payer: string;
  amount: number;
}

@Component({
  selector: 'lib-payment-delete-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="delete-modal-backdrop"
      (click)="onBackdropClick($event)"
      (keydown.enter)="onBackdropClick($event)"
      (keydown.escape)="cancelled.emit()"
      tabindex="0"
      role="button"
      aria-label="Закрыть">
      <div class="delete-modal" (click)="$event.stopPropagation()">
        <div class="delete-modal__header">
          <h3>Подтверждение удаления</h3>
          <button type="button" class="close-btn" (click)="cancelled.emit()">&times;</button>
        </div>
        <div class="delete-modal__body">
          <p>
            Вы уверены, что хотите удалить платёж
            <strong>#{{ payment?.transactionId || payment?.id }}</strong
            >?
          </p>
          <p class="delete-modal__meta">
            Плательщик: {{ payment?.payer }} · Сумма:
            {{ payment?.amount | currency: 'RUB' : 'symbol-narrow' }}
          </p>
        </div>
        <div class="delete-modal__footer">
          <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Отмена</button>
          <button type="button" class="btn btn-danger" (click)="confirmed.emit()">Удалить</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .delete-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgb(15 23 42 / 32%);
      backdrop-filter: blur(4px);
    }

    .delete-modal {
      width: min(420px, 90vw);
      padding: 1.2rem;
      border: 1px solid rgb(220 38 38 / 10%);
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 18px 38px rgb(15 23 42 / 12%);
    }

    .delete-modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .delete-modal__header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }

    .close-btn {
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #94a3b8;
      font-size: 1.25rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .close-btn:hover {
      background: rgb(220 38 38 / 8%);
      color: #dc2626;
    }

    .delete-modal__body {
      margin-bottom: 1.2rem;
    }

    .delete-modal__body p {
      margin: 0 0 0.4rem;
    }

    .delete-modal__meta {
      font-size: 0.85rem;
      color: #64748b;
    }

    .delete-modal__footer {
      display: flex;
      gap: 0.6rem;
      justify-content: flex-end;
    }

    .btn {
      padding: 0.55rem 1rem;
      border: 1px solid transparent;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary {
      border-color: #e2e8f0;
      background: #fff;
      color: #334155;
    }

    .btn-secondary:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
    }

    .btn-danger {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: #fff;
    }

    .btn-danger:hover {
      filter: brightness(1.08);
    }
  `,
})
export class PaymentDeleteModalComponent {
  @Input() payment: PaymentItem | null = null;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdropClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('delete-modal-backdrop')) {
      this.cancelled.emit();
    }
  }
}

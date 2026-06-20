import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlaPriority } from '../support.types';

@Component({
  selector: 'lib-create-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="onClose()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Создание нового тикета</h2>
          <button class="close-btn" (click)="onClose()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Тема тикета *</label>
            <input type="text" [(ngModel)]="ticketData.subject" class="form-control" placeholder="Кратко опишите проблему">
          </div>

          <div class="form-group">
            <label>Email пользователя *</label>
            <input type="email" [(ngModel)]="ticketData.userEmail" class="form-control" placeholder="user@example.com">
          </div>

          <div class="form-group">
            <label>Роль пользователя</label>
            <select [(ngModel)]="ticketData.userRole" class="form-control">
              <option value="user">Обычный пользователь</option>
              <option value="vip">VIP пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          <div class="form-group">
            <label>Приоритет SLA *</label>
            <select [(ngModel)]="ticketData.slaPriority" class="form-control">
              <option value="critical">Критический (ответ в течение 1 часа)</option>
              <option value="high">Высокий (ответ в течение 4 часов)</option>
              <option value="medium">Средний (ответ в течение 24 часов)</option>
              <option value="low">Низкий (ответ в течение 72 часов)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Описание проблемы</label>
            <textarea [(ngModel)]="ticketData.description" rows="4" class="form-control" placeholder="Подробно опишите проблему..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" (click)="onClose()">Отмена</button>
          <button class="btn-create" (click)="onCreate()" [disabled]="!isValid()">Создать тикет</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: #fff;
      border-radius: 12px;
      width: 500px;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;

      h2 {
        margin: 0;
        font-size: 20px;
        color: #1e293b;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #64748b;
        transition: color 0.2s;

        &:hover {
          color: #1e293b;
        }
      }
    }

    .modal-body {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;

      label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #1e293b;
      }

      .form-control {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;

        &:focus {
          outline: none;
          border-color: #3b82f6;
        }
      }

      textarea.form-control {
        resize: vertical;
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid #e2e8f0;
    }

    .btn-cancel {
      padding: 8px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        background: #f1f5f9;
      }
    }

    .btn-create {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      background: #3b82f6;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: #2563eb;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `]
})
export class CreateTicketModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<any>();

  ticketData = {
    subject: '',
    userEmail: '',
    userRole: 'user' as const,
    slaPriority: 'medium' as SlaPriority,
    description: ''
  };

  onClose(): void {
    this.close.emit();
    this.resetForm();
  }

  onCreate(): void {
    if (!this.isValid()) return;

    this.create.emit({
      subject: this.ticketData.subject,
      userEmail: this.ticketData.userEmail,
      slaPriority: this.ticketData.slaPriority,
      description: this.ticketData.description,
    });
    
    this.resetForm();
  }

  isValid(): boolean {
    return this.ticketData.subject.trim().length > 0 && 
           this.ticketData.userEmail.trim().length > 0 &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.ticketData.userEmail);
  }

  resetForm(): void {
    this.ticketData = {
      subject: '',
      userEmail: '',
      userRole: 'user',
      slaPriority: 'medium',
      description: ''
    };
  }
}
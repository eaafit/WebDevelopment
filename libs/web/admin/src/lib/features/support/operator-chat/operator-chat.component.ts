import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportApiService } from '../support-api.service';
import { SupportTicket } from '../support.types';

@Component({
  selector: 'lib-operator-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './operator-chat.component.html',
  styleUrls: ['./operator-chat.component.scss']
})
export class OperatorChatComponent {
  @Input() ticket: SupportTicket | null = null;
  messageText: string = '';
  isSending = false;

  constructor(private supportService: SupportApiService) {}

  sendMessage(): void {
    if (!this.messageText.trim() || !this.ticket || this.isSending) return;
    this.isSending = true;
    void this.supportService
      .addMessage(this.ticket.id, this.messageText.trim())
      .then(() => {
        this.messageText = '';
      })
      .finally(() => {
        this.isSending = false;
      });
  }

  changeStatus(status: 'resolved' | 'closed'): void {
    if (!this.ticket) return;

    const actionText = status === 'resolved' ? 'отметить как решенный' : 'закрыть';
    const confirmed = confirm(`Вы уверены, что хотите ${actionText} данный тикет?`);

    if (!confirmed) return;

    if (status === 'closed') {
      const resolution = prompt('Укажите итоговое решение (необязательно):') ?? '';
      void this.supportService.closeTicket(this.ticket.id, resolution);
      return;
    }

    void this.supportService.updateTicketStatus(this.ticket.id, status);
  }
}

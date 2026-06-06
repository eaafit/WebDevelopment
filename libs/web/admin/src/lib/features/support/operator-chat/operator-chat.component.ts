import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportMockService, SupportTicket } from '../support.mock';

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

  constructor(private supportService: SupportMockService) {}

  sendMessage(): void {
    if (!this.messageText.trim() || !this.ticket) return;
    this.supportService.addMessage(this.ticket.id, this.messageText.trim());
    this.messageText = '';
  }

  changeStatus(status: 'resolved' | 'closed'): void {
    if (!this.ticket) return;
    
    const actionText = status === 'resolved' ? 'отметить как решенный' : 'закрыть';
    const confirmed = confirm(`Вы уверены, что хотите ${actionText} данный тикет?`);
    
    if (confirmed) {
      this.supportService.updateTicketStatus(this.ticket.id, status);
    }
  }
}
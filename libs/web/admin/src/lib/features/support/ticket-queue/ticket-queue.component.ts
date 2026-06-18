import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportApiService } from '../support-api.service';
import { SupportTicket } from '../support.types';

@Component({
  selector: 'lib-ticket-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-queue.component.html',
  styleUrls: ['./ticket-queue.component.scss']
})
export class TicketQueueComponent implements OnChanges {
  @Input() tickets: SupportTicket[] = [];
  @Input() statusFilter: string = 'all';
  @Input() slaFilter: string = 'all';
  @Input() priorityFilter: string = 'all';
  @Input() sortBy: string = 'date_desc';

  filteredTickets: SupportTicket[] = [];

  constructor(private supportService: SupportApiService) {}

  ngOnChanges(): void {
    this.applyFiltersAndSorting();
  }

  applyFiltersAndSorting(): void {
    let result = [...this.tickets];

    if (this.statusFilter !== 'all') {
      result = result.filter(t => t.status === this.statusFilter);
    }

    if (this.slaFilter !== 'all') {
      result = result.filter(t => t.slaStatus === this.slaFilter);
    }

    if (this.priorityFilter !== 'all') {
      result = result.filter(t => t.slaPriority === this.priorityFilter);
    }

    if (this.sortBy === 'date_desc') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (this.sortBy === 'date_asc') {
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (this.sortBy === 'sla_critical') {
      const weight = { breached: 3, warning: 2, normal: 1 };
      result.sort((a, b) => weight[b.slaStatus] - weight[a.slaStatus]);
    } else if (this.sortBy === 'priority_desc') {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      result.sort((a, b) => priorityWeight[b.slaPriority] - priorityWeight[a.slaPriority]);
    }

    this.filteredTickets = result;
  }

  selectTicket(ticket: SupportTicket): void {
    this.supportService.selectTicket(ticket);
  }

  takeToWork(event: Event, ticket: SupportTicket): void {
    event.stopPropagation();
    void this.supportService.updateTicketStatus(ticket.id, 'in_progress');
  }

  getSlaLabel(status: string): string {
    if (status === 'breached') return 'Нарушен';
    if (status === 'warning') return 'Скоро нарушится';
    return 'В норме';
  }

  getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      critical: 'Критический',
      high: 'Высокий',
      medium: 'Средний',
      low: 'Низкий'
    };
    return labels[priority] || priority;
  }

  getRemainingTime(deadline: Date): string {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return 'Просрочено';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} дн. ${hours % 24} ч`;
    }

    return `${hours} ч ${minutes} мин`;
  }
}

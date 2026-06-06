import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportMockService, SupportTicket } from '../support.mock';

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
  @Input() sortBy: string = 'date_desc';

  filteredTickets: SupportTicket[] = [];

  constructor(private supportService: SupportMockService) {}

  ngOnChanges(): void {
    this.applyFiltersAndSorting();
  }

  applyFiltersAndSorting(): void {
    let result = [...this.tickets];

    // Фильтр статусов
    if (this.statusFilter !== 'all') {
      result = result.filter(t => t.status === this.statusFilter);
    }

    // Фильтр SLA
    if (this.slaFilter !== 'all') {
      result = result.filter(t => t.slaStatus === this.slaFilter);
    }

    // Сортировка
    if (this.sortBy === 'date_desc') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (this.sortBy === 'date_asc') {
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (this.sortBy === 'sla_critical') {
      const weight = { breached: 3, warning: 2, normal: 1 };
      result.sort((a, b) => weight[b.slaStatus] - weight[a.slaStatus]);
    }

    this.filteredTickets = result;
  }

  selectTicket(ticket: SupportTicket): void {
    this.supportService.selectTicket(ticket);
  }

  takeToWork(event: Event, ticket: SupportTicket): void {
    event.stopPropagation(); // Чтобы не триггерить выбор тикета кликом по кнопке
    this.supportService.updateTicketStatus(ticket.id, 'in_progress');
  }

  getSlaLabel(status: string): string {
    if (status === 'breached') return 'Нарушен';
    if (status === 'warning') return 'Скоро нарушится';
    return 'В норме';
  }
}
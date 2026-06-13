import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketQueueComponent } from '../ticket-queue/ticket-queue.component';
import { OperatorChatComponent } from '../operator-chat/operator-chat.component';
import { CreateTicketModalComponent } from './create-ticket-modal.component';
import { SupportMockService, SupportTicket } from '../support.mock';
import { Observable, map, Subscription, interval } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'lib-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketQueueComponent, OperatorChatComponent, CreateTicketModalComponent],
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss']
})
export class AdminSupportComponent implements OnInit, OnDestroy {
  tickets$: Observable<SupportTicket[]>;
  selectedTicket$: Observable<SupportTicket | null>;
  showCreateModal = false;
  private slaUpdateSubscription: Subscription;

  // Фильтры
  statusFilter: string = 'all';
  slaFilter: string = 'all';
  priorityFilter: string = 'all';
  sortBy: string = 'date_desc';

  // Счётчики SLA
  openCount$: Observable<number>;
  breachedCount$: Observable<number>;
  resolvedTodayCount$: Observable<number>;

  constructor(private supportService: SupportMockService) {
    this.tickets$ = this.supportService.getTickets();
    this.selectedTicket$ = this.supportService.getSelectedTicket();

    this.openCount$ = this.tickets$.pipe(map(list => list.filter(t => t.status === 'open').length));
    this.breachedCount$ = this.tickets$.pipe(map(list => list.filter(t => t.slaStatus === 'breached').length));
    this.resolvedTodayCount$ = this.tickets$.pipe(map(list => list.filter(t => t.status === 'resolved').length));
    
    // Обновление SLA статусов каждую минуту
    this.slaUpdateSubscription = interval(60000).subscribe(() => {
      this.supportService.updateSlaStatuses();
    });
  }

  ngOnInit(): void {
    // Первоначальное обновление SLA
    this.supportService.updateSlaStatuses();
  }

  ngOnDestroy(): void {
    if (this.slaUpdateSubscription) {
      this.slaUpdateSubscription.unsubscribe();
    }
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  onTicketCreated(ticketData: Partial<SupportTicket>): void {
    this.supportService.createTicket(ticketData);
    this.closeCreateModal();
  }
}
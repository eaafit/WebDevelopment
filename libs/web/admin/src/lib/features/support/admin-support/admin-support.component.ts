import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketQueueComponent } from '../ticket-queue/ticket-queue.component';
import { OperatorChatComponent } from '../operator-chat/operator-chat.component';
import { CreateTicketModalComponent } from './create-ticket-modal.component';
import { SupportApiService } from '../support-api.service';
import { SupportTicket } from '../support.types';
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
  isLoading = true;
  loadError: string | null = null;
  private slaUpdateSubscription: Subscription;
  private pollSubscription: Subscription;

  statusFilter: string = 'all';
  slaFilter: string = 'all';
  priorityFilter: string = 'all';
  sortBy: string = 'date_desc';

  openCount$: Observable<number>;
  breachedCount$: Observable<number>;
  resolvedTodayCount$: Observable<number>;

  constructor(private supportService: SupportApiService) {
    this.tickets$ = this.supportService.getTickets();
    this.selectedTicket$ = this.supportService.getSelectedTicket();

    this.openCount$ = this.tickets$.pipe(map(list => list.filter(t => t.status === 'open').length));
    this.breachedCount$ = this.tickets$.pipe(map(list => list.filter(t => t.slaStatus === 'breached').length));
    this.resolvedTodayCount$ = this.tickets$.pipe(
      map(list => list.filter(t => this.isResolvedToday(t)).length),
    );

    this.slaUpdateSubscription = interval(60000).subscribe(() => {
      this.supportService.updateSlaStatuses();
    });

    this.pollSubscription = interval(10000).subscribe(() => {
      void this.supportService.refreshTickets();
    });
  }

  ngOnInit(): void {
    void this.loadTickets();
    this.supportService.updateSlaStatuses();
  }

  ngOnDestroy(): void {
    this.slaUpdateSubscription.unsubscribe();
    this.pollSubscription.unsubscribe();
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  onTicketCreated(ticketData: {
    subject: string;
    userEmail: string;
    slaPriority: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
  }): void {
    void this.supportService
      .createTicket(ticketData)
      .then(() => this.closeCreateModal())
      .catch((error: Error) => {
        this.loadError = error.message || 'Не удалось создать тикет';
      });
  }

  private async loadTickets(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      await this.supportService.refreshTickets();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Не удалось загрузить тикеты';
    } finally {
      this.isLoading = false;
    }
  }

  private isResolvedToday(ticket: SupportTicket): boolean {
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') return false;
    if (!ticket.resolvedAt) return false;
    const today = new Date();
    return (
      ticket.resolvedAt.getFullYear() === today.getFullYear() &&
      ticket.resolvedAt.getMonth() === today.getMonth() &&
      ticket.resolvedAt.getDate() === today.getDate()
    );
  }
}

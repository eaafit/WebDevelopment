import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketQueueComponent } from '../ticket-queue/ticket-queue.component';
import { OperatorChatComponent } from '../operator-chat/operator-chat.component';
import { SupportMockService, SupportTicket } from '../support.mock';
import { Observable, map } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'lib-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketQueueComponent, OperatorChatComponent],
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss']
})
export class AdminSupportComponent implements OnInit {
  tickets$: Observable<SupportTicket[]>;
  selectedTicket$: Observable<SupportTicket | null>;

  // Фильтры
  statusFilter: string = 'all';
  slaFilter: string = 'all';
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
    this.resolvedTodayCount$ = this.tickets$.pipe(map(list => list.filter(t => t.status === 'resolved').length)); // В рамках мока считаем все resolved
  }

  ngOnInit(): void {}
}
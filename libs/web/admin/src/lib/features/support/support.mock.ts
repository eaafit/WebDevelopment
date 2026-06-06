// libs/web/admin/src/lib/features/support/support.mock.ts

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SlaStatus = 'breached' | 'warning' | 'normal';
export type UserRole = 'user' | 'vip' | 'admin';

export interface TicketAttachment {
  name: string;
  url: string;
}

export interface TicketMessage {
  id: string;
  authorName: string;
  authorRole: 'user' | 'support';
  text: string;
  createdAt: Date;
  attachments?: TicketAttachment[];
}

export interface SupportTicket {
  id: string;
  subject: string;
  userEmail: string;
  userRole: UserRole;
  userRegisteredAt: Date;
  status: TicketStatus;
  slaStatus: SlaStatus;
  createdAt: Date;
  messages: TicketMessage[];
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupportMockService {
  private tickets: SupportTicket[] = [
    {
      id: '1',
      subject: 'Не проходит оплата картой МИР',
      userEmail: 'sergey.govor@example.com',
      userRole: 'vip',
      userRegisteredAt: new Date('2025-01-15'),
      status: 'open',
      slaStatus: 'breached',
      createdAt: new Date(Date.now() - 4 * 3600000), // 4 часа назад
      messages: [
        {
          id: 'm1',
          authorName: 'Сергей Говор',
          authorRole: 'user',
          text: 'Здравствуйте! Пытаюсь оплатить подписку, выдает ошибку 500.',
          createdAt: new Date(Date.now() - 4 * 3600000)
        }
      ]
    },
    {
      id: '2',
      subject: 'Ошибка при рендере графиков',
      userEmail: 'ivan.vasorin@example.com',
      userRole: 'user',
      userRegisteredAt: new Date('2025-03-10'),
      status: 'in_progress',
      slaStatus: 'warning',
      createdAt: new Date(Date.now() - 1.5 * 3600000), // 1.5 часа назад
      messages: [
        {
          id: 'm2',
          authorName: 'Иван Васорин',
          authorRole: 'user',
          text: 'В личном кабинете не отображаются графики за прошлую неделю.',
          createdAt: new Date(Date.now() - 1.5 * 3600000)
        }
      ]
    }
  ];

  private tickets$ = new BehaviorSubject<SupportTicket[]>(this.tickets);
  private selectedTicket$ = new BehaviorSubject<SupportTicket | null>(null);

  getTickets(): Observable<SupportTicket[]> {
    return this.tickets$.asObservable();
  }

  getSelectedTicket(): Observable<SupportTicket | null> {
    return this.selectedTicket$.asObservable();
  }

  selectTicket(ticket: SupportTicket): void {
    this.selectedTicket$.next(ticket);
  }

  updateTicketStatus(ticketId: string, status: TicketStatus): void {
    this.tickets = this.tickets.map(t => t.id === ticketId ? { ...t, status } : t);
    this.tickets$.next(this.tickets);
    
    const currentSelected = this.selectedTicket$.value;
    if (currentSelected && currentSelected.id === ticketId) {
      this.selectedTicket$.next({ ...currentSelected, status });
    }
  }

  addMessage(ticketId: string, messageText: string): void {
    const newMessage: TicketMessage = {
      id: Math.random().toString(),
      authorName: 'Оператор Поддержки',
      authorRole: 'support',
      text: messageText,
      createdAt: new Date()
    };

    this.tickets = this.tickets.map(t => {
      if (t.id === ticketId) {
        return { ...t, messages: [...t.messages, newMessage] };
      }
      return t;
    });

    this.tickets$.next(this.tickets);

    const currentSelected = this.selectedTicket$.value;
    if (currentSelected && currentSelected.id === ticketId) {
      this.selectedTicket$.next({
        ...currentSelected,
        messages: [...currentSelected.messages, newMessage]
      });
    }
  }
}
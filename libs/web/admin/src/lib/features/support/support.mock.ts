// libs/web/admin/src/lib/features/support/support.mock.ts

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SlaStatus = 'breached' | 'warning' | 'normal';
export type SlaPriority = 'low' | 'medium' | 'high' | 'critical';
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
  slaPriority: SlaPriority;
  slaDeadline: Date; // Срок выполнения по SLA
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
      userEmail: '321321@example.com',
      userRole: 'vip',
      userRegisteredAt: new Date('2025-01-15'),
      status: 'open',
      slaStatus: 'breached',
      slaPriority: 'critical',
      slaDeadline: new Date(Date.now() - 2 * 3600000),
      createdAt: new Date(Date.now() - 4 * 3600000),
      messages: [
        {
          id: 'm1',
          authorName: 'Сергей',
          authorRole: 'user',
          text: 'Здравствуйте! Пытаюсь оплатить подписку, выдает ошибку 500.',
          createdAt: new Date(Date.now() - 4 * 3600000)
        }
      ]
    },
    {
      id: '2',
      subject: 'Ошибка при рендере графиков',
      userEmail: '123321@example.com',
      userRole: 'user',
      userRegisteredAt: new Date('2025-03-10'),
      status: 'in_progress',
      slaStatus: 'warning',
      slaPriority: 'high',
      slaDeadline: new Date(Date.now() + 1.5 * 3600000),
      createdAt: new Date(Date.now() - 1.5 * 3600000),
      messages: [
        {
          id: 'm2',
          authorName: 'Иван',
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

  deleteTicket(ticketId: string): void {
    this.tickets = this.tickets.filter(t => t.id !== ticketId);
    this.tickets$.next(this.tickets);
    
    const currentSelected = this.selectedTicket$.value;
    if (currentSelected && currentSelected.id === ticketId) {
      this.selectedTicket$.next(null);
    }
  }

  createTicket(ticketData: Partial<SupportTicket>): void {
    const slaPriority = ticketData.slaPriority || 'medium';
    const slaDeadline = this.calculateSlaDeadline(slaPriority);
    
    const newTicket: SupportTicket = {
      id: Date.now().toString(),
      subject: ticketData.subject || 'Без темы',
      userEmail: ticketData.userEmail || 'unknown@example.com',
      userRole: ticketData.userRole || 'user',
      userRegisteredAt: ticketData.userRegisteredAt || new Date(),
      status: 'open',
      slaStatus: 'normal',
      slaPriority: slaPriority,
      slaDeadline: slaDeadline,
      createdAt: new Date(),
      messages: ticketData.messages || [
        {
          id: Math.random().toString(),
          authorName: ticketData.userEmail?.split('@')[0] || 'Пользователь',
          authorRole: 'user',
          text: ticketData.subject || 'Новый тикет',
          createdAt: new Date()
        }
      ]
    };
    
    this.tickets = [newTicket, ...this.tickets];
    this.tickets$.next(this.tickets);
  }

  private calculateSlaDeadline(priority: SlaPriority): Date {
    const now = new Date();
    switch(priority) {
      case 'critical': return new Date(now.getTime() + 1 * 3600000); // 1 час
      case 'high': return new Date(now.getTime() + 4 * 3600000); // 4 часа
      case 'medium': return new Date(now.getTime() + 24 * 3600000); // 24 часа
      case 'low': return new Date(now.getTime() + 72 * 3600000); // 72 часа
      default: return new Date(now.getTime() + 24 * 3600000);
    }
  }

  updateSlaStatuses(): void {
    this.tickets = this.tickets.map(ticket => {
      const now = new Date();
      const timeLeft = ticket.slaDeadline.getTime() - now.getTime();
      const hoursLeft = timeLeft / (3600000);
      
      let slaStatus: SlaStatus = 'normal';
      if (timeLeft < 0) {
        slaStatus = 'breached';
      } else if (hoursLeft < 2) {
        slaStatus = 'warning';
      }
      
      return { ...ticket, slaStatus };
    });
    this.tickets$.next(this.tickets);
    
    const currentSelected = this.selectedTicket$.value;
    if (currentSelected) {
      const updatedSelected = this.tickets.find(t => t.id === currentSelected.id);
      if (updatedSelected) {
        this.selectedTicket$.next(updatedSelected);
      }
    }
  }
}
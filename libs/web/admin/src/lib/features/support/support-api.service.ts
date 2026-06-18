import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  MessageRole,
  SupportService,
  TicketPriority as RpcTicketPriority,
  TicketStatus as RpcTicketStatus,
  type Ticket as RpcTicket,
  type TicketMessage as RpcTicketMessage,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  applySlaStatuses,
  computeSlaStatus,
  type SlaPriority,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus,
  type UserRole,
} from './support.types';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private readonly client = createClient(SupportService, inject(RPC_TRANSPORT));
  private readonly ticketsSubject = new BehaviorSubject<SupportTicket[]>([]);
  private readonly selectedTicketSubject = new BehaviorSubject<SupportTicket | null>(null);
  private loading = false;

  getTickets(): Observable<SupportTicket[]> {
    return this.ticketsSubject.asObservable();
  }

  getSelectedTicket(): Observable<SupportTicket | null> {
    return this.selectedTicketSubject.asObservable();
  }

  async refreshTickets(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const response = await this.client.listTickets({
        pagination: { page: 1, limit: PAGE_LIMIT },
        statusFilter: RpcTicketStatus.UNSPECIFIED,
      });
      const tickets = await Promise.all(
        (response.tickets ?? []).map((ticket) => this.loadTicketWithMessages(ticket)),
      );
      this.ticketsSubject.next(applySlaStatuses(tickets));

      const selected = this.selectedTicketSubject.value;
      if (selected) {
        const updated = tickets.find((ticket) => ticket.id === selected.id);
        this.selectedTicketSubject.next(updated ? applySlaStatuses([updated])[0] : null);
      }
    } finally {
      this.loading = false;
    }
  }

  selectTicket(ticket: SupportTicket): void {
    this.selectedTicketSubject.next(ticket);
    void this.refreshSelectedMessages(ticket.id);
  }

  updateSlaStatuses(): void {
    const tickets = applySlaStatuses(this.ticketsSubject.value);
    this.ticketsSubject.next(tickets);
    const selected = this.selectedTicketSubject.value;
    if (selected) {
      const updated = tickets.find((ticket) => ticket.id === selected.id);
      if (updated) {
        this.selectedTicketSubject.next(updated);
      }
    }
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
    const rpcStatus = mapUiStatusToRpc(status);
    const response = await this.client.updateTicketStatus({ id: ticketId, status: rpcStatus });
    await this.applyTicketUpdate(response.ticket);
  }

  async addMessage(ticketId: string, messageText: string): Promise<void> {
    const response = await this.client.addMessage({ ticketId, text: messageText });
    await this.applyTicketUpdate(response.ticket);
  }

  async closeTicket(ticketId: string, resolution: string): Promise<void> {
    const response = await this.client.closeTicket({ id: ticketId, resolution });
    await this.applyTicketUpdate(response.ticket);
  }

  async createTicket(params: {
    subject: string;
    userEmail: string;
    slaPriority: SlaPriority;
    description?: string;
  }): Promise<void> {
    await this.client.createTicket({
      subject: params.subject,
      text: params.description ?? '',
      priority: mapUiPriorityToRpc(params.slaPriority),
      authorEmail: params.userEmail,
    });
    await this.refreshTickets();
  }

  private async refreshSelectedMessages(ticketId: string): Promise<void> {
    try {
      const response = await this.client.listMessages({
        ticketId,
        pagination: { page: 1, limit: PAGE_LIMIT },
      });
      const messages = (response.messages ?? []).map((message) => this.toUiMessage(message));
      this.patchTicket(ticketId, (ticket) => ({ ...ticket, messages }));
    } catch (error) {
      if (error instanceof ConnectError) {
        console.error('Failed to load ticket messages', error.message);
      }
      throw error;
    }
  }

  private async loadTicketWithMessages(ticket: RpcTicket): Promise<SupportTicket> {
    const response = await this.client.listMessages({
      ticketId: ticket.id,
      pagination: { page: 1, limit: PAGE_LIMIT },
    });
    return this.toUiTicket(ticket, response.messages ?? []);
  }

  private async applyTicketUpdate(ticket: RpcTicket | undefined): Promise<void> {
    if (!ticket) {
      await this.refreshTickets();
      return;
    }

    const withMessages = await this.loadTicketWithMessages(ticket);
    this.patchLists(withMessages);
  }

  private patchLists(ticket: SupportTicket): void {
    const tickets = applySlaStatuses(
      this.ticketsSubject.value.some((item) => item.id === ticket.id)
        ? this.ticketsSubject.value.map((item) => (item.id === ticket.id ? ticket : item))
        : [...this.ticketsSubject.value, ticket],
    );
    this.ticketsSubject.next(tickets);
    if (this.selectedTicketSubject.value?.id === ticket.id) {
      this.selectedTicketSubject.next(applySlaStatuses([ticket])[0]);
    }
  }

  private patchTicket(ticketId: string, updater: (ticket: SupportTicket) => SupportTicket): void {
    const tickets = this.ticketsSubject.value.map((ticket) =>
      ticket.id === ticketId ? updater(ticket) : ticket,
    );
    this.ticketsSubject.next(applySlaStatuses(tickets));
    const selected = this.selectedTicketSubject.value;
    if (selected?.id === ticketId) {
      this.selectedTicketSubject.next(applySlaStatuses([updater(selected)])[0]);
    }
  }

  private toUiTicket(ticket: RpcTicket, messages: RpcTicketMessage[] = []): SupportTicket {
    const slaDeadline = ticket.slaDeadline ? timestampDate(ticket.slaDeadline) : new Date();
    const createdAt = ticket.createdAt ? timestampDate(ticket.createdAt) : new Date();
    const resolvedAt = ticket.resolvedAt ? timestampDate(ticket.resolvedAt) : undefined;
    const author = ticket.author;

    return {
      id: ticket.id,
      subject: ticket.subject,
      userEmail: author?.email ?? 'unknown@example.com',
      userRole: mapAuthorRole(author?.email),
      userRegisteredAt: author?.registeredAt ? timestampDate(author.registeredAt) : createdAt,
      status: mapRpcStatusToUi(ticket.status),
      slaStatus: computeSlaStatus(slaDeadline),
      slaPriority: mapRpcPriorityToUi(ticket.priority),
      slaDeadline,
      createdAt,
      resolvedAt,
      messages: messages.map((message) => this.toUiMessage(message)),
    };
  }

  private toUiMessage(message: RpcTicketMessage): TicketMessage {
    return {
      id: message.id,
      authorName: message.authorName || 'Пользователь',
      authorRole: mapRpcMessageRoleToUi(message.role),
      text: message.text,
      createdAt: message.createdAt ? timestampDate(message.createdAt) : new Date(),
    };
  }
}

function mapRpcStatusToUi(status: RpcTicketStatus): TicketStatus {
  switch (status) {
    case RpcTicketStatus.OPEN:
      return 'open';
    case RpcTicketStatus.IN_PROGRESS:
      return 'in_progress';
    case RpcTicketStatus.RESOLVED:
      return 'resolved';
    case RpcTicketStatus.CLOSED:
      return 'closed';
    default:
      return 'open';
  }
}

function mapUiStatusToRpc(status: TicketStatus): RpcTicketStatus {
  switch (status) {
    case 'open':
      return RpcTicketStatus.OPEN;
    case 'in_progress':
      return RpcTicketStatus.IN_PROGRESS;
    case 'resolved':
      return RpcTicketStatus.RESOLVED;
    case 'closed':
      return RpcTicketStatus.CLOSED;
    default:
      return RpcTicketStatus.UNSPECIFIED;
  }
}

function mapRpcPriorityToUi(priority: RpcTicketPriority): SlaPriority {
  switch (priority) {
    case RpcTicketPriority.LOW:
      return 'low';
    case RpcTicketPriority.HIGH:
      return 'high';
    case RpcTicketPriority.URGENT:
      return 'critical';
    case RpcTicketPriority.MEDIUM:
    default:
      return 'medium';
  }
}

function mapUiPriorityToRpc(priority: SlaPriority): RpcTicketPriority {
  switch (priority) {
    case 'low':
      return RpcTicketPriority.LOW;
    case 'high':
      return RpcTicketPriority.HIGH;
    case 'critical':
      return RpcTicketPriority.URGENT;
    case 'medium':
    default:
      return RpcTicketPriority.MEDIUM;
  }
}

function mapRpcMessageRoleToUi(role: MessageRole): TicketMessage['authorRole'] {
  switch (role) {
    case MessageRole.SUPPORT:
      return 'support';
    case MessageRole.AI:
      return 'ai';
    case MessageRole.USER:
    default:
      return 'user';
  }
}

function mapAuthorRole(email?: string): UserRole {
  if (!email) return 'user';
  if (email.includes('admin')) return 'admin';
  return 'user';
}

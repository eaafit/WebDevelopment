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
  authorRole: 'user' | 'support' | 'ai';
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
  slaDeadline: Date;
  createdAt: Date;
  resolvedAt?: Date;
  messages: TicketMessage[];
}

export function computeSlaStatus(deadline: Date, now = new Date()): SlaStatus {
  const timeLeft = deadline.getTime() - now.getTime();
  if (timeLeft < 0) return 'breached';
  if (timeLeft / 3600000 < 2) return 'warning';
  return 'normal';
}

export function applySlaStatuses(tickets: SupportTicket[], now = new Date()): SupportTicket[] {
  return tickets.map((ticket) => ({
    ...ticket,
    slaStatus: computeSlaStatus(ticket.slaDeadline, now),
  }));
}

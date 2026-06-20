import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { getCurrentUser, requireAuth, requireRole, requireSelfOrRole, Role } from '@internal/auth-shared';
import { PrismaService } from '@internal/prisma';
import {
  TicketMessageRole as PrismaMessageRole,
  TicketPriority as PrismaPriority,
  TicketStatus as PrismaStatus,
  type Ticket,
  type TicketMessage,
  type User,
} from '@internal/prisma-client';
import {
  AddMessageResponseSchema,
  AskSupportAiResponseSchema,
  CloseTicketResponseSchema,
  CreateTicketResponseSchema,
  EscalateToOperatorResponseSchema,
  GetTicketResponseSchema,
  ListMessagesResponseSchema,
  ListTicketsResponseSchema,
  MessageRole,
  PaginationMetaSchema,
  TicketPriority,
  TicketStatus,
  TicketAuthorSchema,
  TicketMessageSchema,
  TicketSchema,
  UpdateTicketStatusResponseSchema,
  type AddMessageRequest,
  type AddMessageResponse,
  type AskSupportAiRequest,
  type AskSupportAiResponse,
  type CloseTicketRequest,
  type CloseTicketResponse,
  type CreateTicketRequest,
  type CreateTicketResponse,
  type EscalateToOperatorRequest,
  type EscalateToOperatorResponse,
  type GetTicketRequest,
  type GetTicketResponse,
  type ListMessagesRequest,
  type ListMessagesResponse,
  type ListTicketsRequest,
  type ListTicketsResponse,
  type Ticket as RpcTicket,
  type TicketMessage as RpcTicketMessage,
  type UpdateTicketStatusRequest,
  type UpdateTicketStatusResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

type TicketWithAuthor = Ticket & { author: User; assignee?: User | null };
type TicketMessageWithAuthor = TicketMessage & { author: User };

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async askSupportAi(request: AskSupportAiRequest): Promise<AskSupportAiResponse> {
    requireAuth();
    const question = request.questionText.trim();
    if (!question) {
      throw new ConnectError('question_text is required', Code.InvalidArgument);
    }

    const answerText =
      'Спасибо за ваш вопрос. Это автоматический ответ службы поддержки (stub GigaChat). ' +
      'Если ответ не помог, нажмите «Переключиться на оператора», и мы создадим тикет с историей диалога.';

    return create(AskSupportAiResponseSchema, { answerText });
  }

  async escalateToOperator(request: EscalateToOperatorRequest): Promise<EscalateToOperatorResponse> {
    const actor = requireAuth();
    const subject = request.subject.trim();
    if (!subject) {
      throw new ConnectError('subject is required', Code.InvalidArgument);
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          subject,
          status: PrismaStatus.Open,
          priority: PrismaPriority.Medium,
          authorId: actor.sub,
          slaDeadline: calculateSlaDeadline(PrismaPriority.Medium),
        },
        include: { author: true, assignee: true },
      });

      for (const item of request.history) {
        const text = item.text.trim();
        if (!text) continue;
        await tx.ticketMessage.create({
          data: {
            ticketId: created.id,
            authorId: actor.sub,
            role: mapRpcMessageRoleToPrisma(item.role),
            text,
          },
        });
      }

      return created;
    });

    return create(EscalateToOperatorResponseSchema, {
      ticket: this.toRpcTicket(ticket),
    });
  }

  async createTicket(request: CreateTicketRequest): Promise<CreateTicketResponse> {
    const actor = requireAuth();
    const subject = request.subject.trim();
    if (!subject) {
      throw new ConnectError('subject is required', Code.InvalidArgument);
    }

    const priority = mapRpcPriorityToPrisma(request.priority);
    const authorId = await this.resolveAuthorId(actor, request.authorEmail?.trim());

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          subject,
          status: PrismaStatus.Open,
          priority,
          authorId,
          slaDeadline: calculateSlaDeadline(priority),
        },
        include: { author: true, assignee: true },
      });

      const text = request.text.trim();
      if (text) {
        await tx.ticketMessage.create({
          data: {
            ticketId: created.id,
            authorId,
            role: PrismaMessageRole.User,
            text,
          },
        });
      }

      return created;
    });

    return create(CreateTicketResponseSchema, {
      ticket: this.toRpcTicket(ticket),
    });
  }

  async getTicket(request: GetTicketRequest): Promise<GetTicketResponse> {
    validateUuid(request.id, 'id');
    const ticket = await this.findTicketOrThrow(request.id);
    this.assertTicketAccess(ticket.authorId);

    return create(GetTicketResponseSchema, {
      ticket: this.toRpcTicket(ticket),
    });
  }

  async listTickets(request: ListTicketsRequest): Promise<ListTicketsResponse> {
    const actor = requireAuth();
    const page = normalizePage(request.pagination?.page);
    const limit = normalizeLimit(request.pagination?.limit);
    const isAdmin = normalizeRole(actor.role) === Role.Admin;

    const where: { authorId?: string; status?: PrismaStatus } = {};
    if (!isAdmin) {
      where.authorId = actor.sub;
    }
    const statusFilter = mapRpcStatusFilterToPrisma(request.statusFilter);
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [total, tickets] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: { author: true, assignee: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListTicketsResponseSchema, {
      tickets: tickets.map((ticket) => this.toRpcTicket(ticket)),
      meta: create(PaginationMetaSchema, {
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  async addMessage(request: AddMessageRequest): Promise<AddMessageResponse> {
    const actor = requireAuth();
    validateUuid(request.ticketId, 'ticket_id');
    const text = request.text.trim();
    if (!text) {
      throw new ConnectError('text is required', Code.InvalidArgument);
    }

    const ticket = await this.findTicketOrThrow(request.ticketId);
    this.assertTicketAccess(ticket.authorId);

    if (ticket.status === PrismaStatus.Closed) {
      throw new ConnectError('Cannot message in closed ticket', Code.FailedPrecondition);
    }

    const isAdmin = normalizeRole(actor.role) === Role.Admin;
    const messageRole = isAdmin ? PrismaMessageRole.Support : PrismaMessageRole.User;

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: actor.sub,
          role: messageRole,
          text,
          attachmentIds: request.attachmentIds ?? [],
        },
        include: { author: true },
      });

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          ...(isAdmin
            ? {
                status:
                  ticket.status === PrismaStatus.Open || ticket.status === PrismaStatus.Resolved
                    ? PrismaStatus.InProgress
                    : ticket.status,
                assigneeId: actor.sub,
              }
            : {}),
        },
        include: { author: true, assignee: true },
      });

      return { message, ticket: updatedTicket };
    });

    return create(AddMessageResponseSchema, {
      message: this.toRpcMessage(result.message),
      ticket: this.toRpcTicket(result.ticket),
    });
  }

  async listMessages(request: ListMessagesRequest): Promise<ListMessagesResponse> {
    validateUuid(request.ticketId, 'ticket_id');
    const ticket = await this.findTicketOrThrow(request.ticketId);
    this.assertTicketAccess(ticket.authorId);

    const page = normalizePage(request.pagination?.page);
    const limit = normalizeLimit(request.pagination?.limit);

    const where = { ticketId: request.ticketId };
    const [total, messages] = await this.prisma.$transaction([
      this.prisma.ticketMessage.count({ where }),
      this.prisma.ticketMessage.findMany({
        where,
        include: { author: true },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListMessagesResponseSchema, {
      messages: messages.map((message) => this.toRpcMessage(message)),
      meta: create(PaginationMetaSchema, {
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  async updateTicketStatus(request: UpdateTicketStatusRequest): Promise<UpdateTicketStatusResponse> {
    requireRole(Role.Admin);
    validateUuid(request.id, 'id');

    const nextStatus = mapRpcStatusToPrisma(request.status);
    if (!nextStatus) {
      throw new ConnectError('status is required', Code.InvalidArgument);
    }

    const ticket = await this.findTicketOrThrow(request.id);
    if (ticket.status === PrismaStatus.Closed) {
      throw new ConnectError('Ticket is already closed', Code.FailedPrecondition);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        ...(nextStatus === PrismaStatus.Resolved || nextStatus === PrismaStatus.Closed
          ? { resolvedAt: new Date() }
          : {}),
        ...(nextStatus === PrismaStatus.InProgress && getCurrentUser()
          ? { assigneeId: getCurrentUser()!.sub }
          : {}),
      },
      include: { author: true, assignee: true },
    });

    return create(UpdateTicketStatusResponseSchema, {
      ticket: this.toRpcTicket(updated),
    });
  }

  async closeTicket(request: CloseTicketRequest): Promise<CloseTicketResponse> {
    requireRole(Role.Admin);
    validateUuid(request.id, 'id');

    const ticket = await this.findTicketOrThrow(request.id);
    if (ticket.status === PrismaStatus.Closed) {
      throw new ConnectError('Ticket is already closed', Code.FailedPrecondition);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: PrismaStatus.Closed,
        resolution: request.resolution.trim() || null,
        resolvedAt: new Date(),
        assigneeId: getCurrentUser()?.sub ?? ticket.assigneeId,
      },
      include: { author: true, assignee: true },
    });

    return create(CloseTicketResponseSchema, {
      ticket: this.toRpcTicket(updated),
    });
  }

  private async findTicketOrThrow(id: string): Promise<TicketWithAuthor> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { author: true, assignee: true },
    });
    if (!ticket) {
      throw new ConnectError('Ticket not found', Code.NotFound);
    }
    return ticket;
  }

  private assertTicketAccess(authorId: string): void {
    requireSelfOrRole(authorId, Role.Admin);
  }

  private async resolveAuthorId(
    actor: { sub: string; role: string },
    authorEmail?: string,
  ): Promise<string> {
    if (authorEmail) {
      requireRole(Role.Admin);
      const user = await this.prisma.user.findUnique({ where: { email: authorEmail } });
      if (!user) {
        throw new ConnectError(`User with email ${authorEmail} not found`, Code.NotFound);
      }
      return user.id;
    }
    return actor.sub;
  }

  private toRpcTicket(ticket: TicketWithAuthor): RpcTicket {
    return create(TicketSchema, {
      id: ticket.id,
      subject: ticket.subject,
      status: mapPrismaStatusToRpc(ticket.status),
      priority: mapPrismaPriorityToRpc(ticket.priority),
      authorId: ticket.authorId,
      slaDeadline: timestampFromDate(ticket.slaDeadline),
      createdAt: timestampFromDate(ticket.createdAt),
      updatedAt: timestampFromDate(ticket.updatedAt),
      author: create(TicketAuthorSchema, {
        id: ticket.author.id,
        email: ticket.author.email,
        fullName: ticket.author.fullName,
        registeredAt: timestampFromDate(ticket.author.createdAt),
      }),
      assigneeId: ticket.assigneeId ?? undefined,
      resolution: ticket.resolution ?? undefined,
      resolvedAt: ticket.resolvedAt ? timestampFromDate(ticket.resolvedAt) : undefined,
    });
  }

  private toRpcMessage(message: TicketMessageWithAuthor): RpcTicketMessage {
    return create(TicketMessageSchema, {
      id: message.id,
      ticketId: message.ticketId,
      authorId: message.authorId,
      authorName: message.author.fullName,
      role: mapPrismaMessageRoleToRpc(message.role),
      text: message.text,
      attachmentIds: message.attachmentIds,
      createdAt: timestampFromDate(message.createdAt),
    });
  }
}

function calculateSlaDeadline(priority: PrismaPriority): Date {
  const now = Date.now();
  const hoursByPriority: Record<PrismaPriority, number> = {
    [PrismaPriority.Urgent]: 1,
    [PrismaPriority.High]: 4,
    [PrismaPriority.Medium]: 24,
    [PrismaPriority.Low]: 72,
  };
  return new Date(now + hoursByPriority[priority] * 3600000);
}

function normalizePage(page?: number): number {
  return page && page > 0 ? page : DEFAULT_PAGE;
}

function normalizeLimit(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

function validateUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ConnectError(`${field} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizeRole(role: string): Role {
  const numericMap: Record<string, Role> = {
    '1': Role.Applicant,
    '2': Role.Notary,
    '3': Role.Admin,
  };
  const directMap: Record<string, Role> = {
    USER_ROLE_APPLICANT: Role.Applicant,
    USER_ROLE_NOTARY: Role.Notary,
    USER_ROLE_ADMIN: Role.Admin,
  };
  return numericMap[role] ?? directMap[role] ?? Role.Applicant;
}

function mapRpcPriorityToPrisma(priority: TicketPriority): PrismaPriority {
  switch (priority) {
    case TicketPriority.LOW:
      return PrismaPriority.Low;
    case TicketPriority.HIGH:
      return PrismaPriority.High;
    case TicketPriority.URGENT:
      return PrismaPriority.Urgent;
    case TicketPriority.MEDIUM:
    default:
      return PrismaPriority.Medium;
  }
}

function mapPrismaPriorityToRpc(priority: PrismaPriority): TicketPriority {
  switch (priority) {
    case PrismaPriority.Low:
      return TicketPriority.LOW;
    case PrismaPriority.High:
      return TicketPriority.HIGH;
    case PrismaPriority.Urgent:
      return TicketPriority.URGENT;
    case PrismaPriority.Medium:
    default:
      return TicketPriority.MEDIUM;
  }
}

function mapRpcStatusFilterToPrisma(status: TicketStatus): PrismaStatus | undefined {
  switch (status) {
    case TicketStatus.OPEN:
      return PrismaStatus.Open;
    case TicketStatus.IN_PROGRESS:
      return PrismaStatus.InProgress;
    case TicketStatus.RESOLVED:
      return PrismaStatus.Resolved;
    case TicketStatus.CLOSED:
      return PrismaStatus.Closed;
    default:
      return undefined;
  }
}

function mapRpcStatusToPrisma(status: TicketStatus): PrismaStatus | undefined {
  return mapRpcStatusFilterToPrisma(status);
}

function mapPrismaStatusToRpc(status: PrismaStatus): TicketStatus {
  switch (status) {
    case PrismaStatus.Open:
      return TicketStatus.OPEN;
    case PrismaStatus.InProgress:
      return TicketStatus.IN_PROGRESS;
    case PrismaStatus.Resolved:
      return TicketStatus.RESOLVED;
    case PrismaStatus.Closed:
      return TicketStatus.CLOSED;
    default:
      return TicketStatus.UNSPECIFIED;
  }
}

function mapRpcMessageRoleToPrisma(role: MessageRole): PrismaMessageRole {
  switch (role) {
    case MessageRole.AI:
      return PrismaMessageRole.Ai;
    case MessageRole.SUPPORT:
      return PrismaMessageRole.Support;
    case MessageRole.USER:
    default:
      return PrismaMessageRole.User;
  }
}

function mapPrismaMessageRoleToRpc(role: PrismaMessageRole): MessageRole {
  switch (role) {
    case PrismaMessageRole.Ai:
      return MessageRole.AI;
    case PrismaMessageRole.Support:
      return MessageRole.SUPPORT;
    case PrismaMessageRole.User:
    default:
      return MessageRole.USER;
  }
}

import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { Role, requireRole, type AccessTokenPayload } from '@internal/auth-shared';
import { NotificationService } from '@internal/notification';
import {
  EstimateNewsletterAudienceResponseSchema,
  NewsletterAudienceType,
  NotificationType as RpcNotificationType,
  SendNewsletterCampaignResponseSchema,
  UserRole,
  type EstimateNewsletterAudienceRequest,
  type EstimateNewsletterAudienceResponse,
  type ListNewsletterCampaignsRequest,
  type ListNewsletterCampaignsResponse,
  type ListNewsletterSubscribersRequest,
  type ListNewsletterSubscribersResponse,
  type NewsletterAudience,
  type SendNewsletterCampaignRequest,
  type SendNewsletterCampaignResponse,
} from '@notary-portal/api-contracts';
import {
  NewsletterAudienceType as PrismaNewsletterAudienceType,
  NewsletterCampaignStatus as PrismaNewsletterCampaignStatus,
  Role as PrismaRole,
} from '@internal/prisma-client';
import {
  NEWSLETTER_MAILER,
  type NewsletterMailer,
} from './newsletter-mailer.interface';
import {
  NewsletterRepository,
  type NewsletterAudienceQuery,
} from './newsletter.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 50_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface NewsletterCampaignSummary {
  id: string;
  subject: string;
  audienceLabel: string;
  recipientsCount: number;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly newsletterRepository: NewsletterRepository,
    @Inject(NEWSLETTER_MAILER) private readonly newsletterMailer: NewsletterMailer,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  listNewsletterSubscribers(
    request: ListNewsletterSubscribersRequest,
  ): Promise<ListNewsletterSubscribersResponse> {
    requireRole(Role.Admin);
    const filters = request.filters;

    return this.newsletterRepository.listSubscribers({
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePageLimit(request.pagination?.limit),
      search: normalizeOptionalString(filters?.query),
      status: filters?.status
        ? this.newsletterRepository.toPrismaStatus(filters.status)
        : undefined,
      role: filters?.role ? this.newsletterRepository.toPrismaRole(filters.role) : undefined,
    });
  }

  listNewsletterCampaigns(
    request: ListNewsletterCampaignsRequest,
  ): Promise<ListNewsletterCampaignsResponse> {
    requireRole(Role.Admin);

    return this.newsletterRepository.listCampaigns({
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePageLimit(request.pagination?.limit),
      search: normalizeOptionalString(request.filters?.query),
    });
  }

  async estimateNewsletterAudience(
    request: EstimateNewsletterAudienceRequest,
  ): Promise<EstimateNewsletterAudienceResponse> {
    requireRole(Role.Admin);
    const audience = this.normalizeAudience(request.audience);
    const recipients = await this.newsletterRepository.resolveAudience(audience);

    return create(EstimateNewsletterAudienceResponseSchema, {
      recipientsCount: recipients.length,
    });
  }

  async sendNewsletterCampaign(
    request: SendNewsletterCampaignRequest,
  ): Promise<SendNewsletterCampaignResponse> {
    const actor = requireRole(Role.Admin);
    const audience = this.normalizeAudience(request.audience);
    const subject = normalizeRequiredString(request.subject, 'subject', MAX_SUBJECT_LENGTH);
    const bodyHtml = normalizeBodyHtml(request.bodyHtml);
    const recipients = await this.newsletterRepository.resolveAudience(audience);

    if (!recipients.length) {
      throw new ConnectError('newsletter audience is empty', Code.FailedPrecondition);
    }

    const campaign = await this.newsletterRepository.createCampaign({
      createdById: isUuid(actor.sub) ? actor.sub : null,
      subject,
      bodyHtml,
      audience,
      audienceLabel: buildAudienceLabel(audience, recipients.length),
      recipients,
    });

    this.logCampaignStart(campaign.id, subject, campaign.audienceLabel, recipients.length);
    await this.recordCampaignAuditBestEffort({
      actor,
      campaign,
      eventType: 'newsletter.campaign.started',
      sentCount: 0,
      failedCount: 0,
      status: PrismaNewsletterCampaignStatus.Sending,
    });

    let sentCount = 0;
    let failedCount = 0;
    let interruptedError: unknown = null;

    try {
      for (const recipient of recipients) {
        try {
          await this.newsletterMailer.sendNewsletterEmail({
            to: recipient.email,
            fullName: recipient.fullName,
            subject,
            bodyHtml,
          });
        } catch (error) {
          const deliveryErrorMessage = normalizeErrorMessage(error);
          failedCount += 1;
          this.logDeliveryFailure(campaign.id, recipient.email, deliveryErrorMessage);

          try {
            await this.newsletterRepository.markDeliveryFailed(
              campaign.id,
              recipient.email,
              deliveryErrorMessage,
            );
          } catch (deliveryUpdateError) {
            interruptedError = deliveryUpdateError;
            break;
          }

          continue;
        }

        sentCount += 1;

        try {
          await this.newsletterRepository.markDeliverySent(campaign.id, recipient.email);
        } catch (deliveryUpdateError) {
          interruptedError = deliveryUpdateError;
          break;
        }
      }
    } catch (error) {
      interruptedError = error;
    }

    const finalStatus = resolveCampaignStatus(sentCount, failedCount, interruptedError !== null);

    if (interruptedError) {
      this.logger.error(
        `newsletter.campaign.send_flow_interrupted campaignId=${campaign.id} status=${formatCampaignStatus(finalStatus)} sentCount=${sentCount} failedCount=${failedCount} error="${normalizeErrorMessage(interruptedError)}"`,
      );
    }

    const completedCampaign = await this.newsletterRepository.completeCampaign(campaign.id, {
      sentCount,
      failedCount,
      status: finalStatus,
    });

    this.logCampaignCompletion(campaign.id, finalStatus, sentCount, failedCount);
    await this.recordCampaignAuditBestEffort({
      actor,
      campaign: completedCampaign,
      eventType: 'newsletter.campaign.completed',
      sentCount,
      failedCount,
      status: finalStatus,
    });
    await this.createCampaignSummaryNotificationBestEffort({
      actor,
      campaign: completedCampaign,
      sentCount,
      failedCount,
      status: finalStatus,
    });

    return create(SendNewsletterCampaignResponseSchema, {
      campaign: completedCampaign,
    });
  }

  private logCampaignStart(
    campaignId: string,
    subject: string,
    audienceLabel: string,
    recipientsCount: number,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'newsletter.campaign.started',
        campaignId,
        subject,
        audienceLabel,
        recipientsCount,
      }),
    );
  }

  private logDeliveryFailure(
    campaignId: string,
    recipientEmail: string,
    errorMessage: string,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'newsletter.campaign.delivery_failed',
        campaignId,
        recipientEmail,
        errorMessage,
      }),
    );
  }

  private logCampaignCompletion(
    campaignId: string,
    status: PrismaNewsletterCampaignStatus,
    sentCount: number,
    failedCount: number,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'newsletter.campaign.completed',
        campaignId,
        status: formatCampaignStatus(status),
        sentCount,
        failedCount,
      }),
    );
  }

  private async recordCampaignAuditBestEffort(input: {
    actor: AccessTokenPayload;
    campaign: NewsletterCampaignSummary;
    eventType: 'newsletter.campaign.started' | 'newsletter.campaign.completed';
    sentCount: number;
    failedCount: number;
    status: PrismaNewsletterCampaignStatus;
  }): Promise<void> {
    try {
      await this.auditService.record({
        actorUserId: input.actor.sub,
        eventType: input.eventType,
        targetType: 'NewsletterCampaign',
        targetId: input.campaign.id,
        actionTitle:
          input.eventType === 'newsletter.campaign.started'
            ? 'Запущена кампания рассылки'
            : 'Кампания рассылки завершена',
        actionContext:
          input.eventType === 'newsletter.campaign.started'
            ? `Получателей: ${input.campaign.recipientsCount}`
            : `Отправлено: ${input.sentCount}, ошибок: ${input.failedCount}`,
        targetTitle: input.campaign.subject,
        targetContext: input.campaign.audienceLabel,
        after: {
          subject: input.campaign.subject,
          audienceLabel: input.campaign.audienceLabel,
          recipientsCount: input.campaign.recipientsCount,
          sentCount: input.sentCount,
          failedCount: input.failedCount,
          status: formatCampaignStatus(input.status),
          actor: {
            userId: input.actor.sub,
            email: input.actor.email,
            role: input.actor.role,
          },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record newsletter audit event ${input.eventType} for campaign ${input.campaign.id}: ${normalizeErrorMessage(error)}`,
      );
    }
  }

  private async createCampaignSummaryNotificationBestEffort(input: {
    actor: AccessTokenPayload;
    campaign: NewsletterCampaignSummary;
    sentCount: number;
    failedCount: number;
    status: PrismaNewsletterCampaignStatus;
  }): Promise<void> {
    try {
      await this.notificationService.createNotification({
        userId: input.actor.sub,
        type: RpcNotificationType.PUSH,
        message: buildCampaignSummaryNotificationMessage(
          input.campaign.subject,
          input.campaign.recipientsCount,
          input.sentCount,
          input.failedCount,
          input.status,
        ),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create newsletter summary notification for campaign ${input.campaign.id}: ${normalizeErrorMessage(error)}`,
      );
    }
  }

  private normalizeAudience(audience: NewsletterAudience | undefined): NewsletterAudienceQuery {
    if (!audience) {
      throw new ConnectError('audience is required', Code.InvalidArgument);
    }

    const type = this.newsletterRepository.toPrismaAudienceType(audience.type);
    if (!type) {
      throw new ConnectError('audience.type is required', Code.InvalidArgument);
    }

    if (audience.type === NewsletterAudienceType.ROLE) {
      const role = this.newsletterRepository.toPrismaRole(audience.role);
      if (!role || audience.role === UserRole.UNSPECIFIED) {
        throw new ConnectError('audience.role is required for role audience', Code.InvalidArgument);
      }

      return { type, role };
    }

    if (audience.type === NewsletterAudienceType.SELECTED) {
      const selectedUserIds = Array.from(new Set(audience.selectedUserIds.map((id) => id.trim())));
      if (!selectedUserIds.length) {
        throw new ConnectError(
          'audience.selected_user_ids is required for selected audience',
          Code.InvalidArgument,
        );
      }

      const invalid = selectedUserIds.find((id) => !isUuid(id));
      if (invalid) {
        throw new ConnectError('audience.selected_user_ids must contain UUID values', Code.InvalidArgument);
      }

      return { type, selectedUserIds };
    }

    return { type };
  }
}

function normalizePageLimit(value: number | undefined): number {
  const limit = normalizePositiveInt(value, DEFAULT_LIMIT);
  if (limit > MAX_PAGE_LIMIT) {
    throw new ConnectError(`pagination.limit must not exceed ${MAX_PAGE_LIMIT}`, Code.InvalidArgument);
  }
  return limit;
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError('pagination values must be positive integers', Code.InvalidArgument);
  }
  return value;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequiredString(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ConnectError(`${field} is required`, Code.InvalidArgument);
  }
  if (normalized.length > maxLength) {
    throw new ConnectError(`${field} must not exceed ${maxLength} characters`, Code.InvalidArgument);
  }
  return normalized;
}

function normalizeBodyHtml(value: string): string {
  const normalized = normalizeRequiredString(value, 'body_html', MAX_BODY_LENGTH);
  if (/<[a-z][\s\S]*>/i.test(normalized)) {
    return normalized;
  }

  return escapeHtml(normalized).replace(/\r?\n/g, '<br>');
}

function buildAudienceLabel(audience: NewsletterAudienceQuery, recipientsCount: number): string {
  if (audience.type === PrismaNewsletterAudienceType.All) {
    return `Все активные подписчики (${recipientsCount})`;
  }
  if (audience.type === PrismaNewsletterAudienceType.Role) {
    return `Роль: ${roleLabel(audience.role)} (${recipientsCount})`;
  }
  return `Выбранные вручную (${recipientsCount})`;
}

function roleLabel(role: NewsletterAudienceQuery['role']): string {
  if (role === PrismaRole.Admin) return 'Администратор';
  if (role === PrismaRole.Notary) return 'Нотариус';
  return 'Заявитель';
}

function resolveCampaignStatus(
  sentCount: number,
  failedCount: number,
  interrupted: boolean,
): PrismaNewsletterCampaignStatus {
  if (interrupted) {
    if (sentCount === 0) return PrismaNewsletterCampaignStatus.Failed;
    return PrismaNewsletterCampaignStatus.PartialFailed;
  }

  if (failedCount === 0) return PrismaNewsletterCampaignStatus.Sent;
  if (sentCount === 0) return PrismaNewsletterCampaignStatus.Failed;
  return PrismaNewsletterCampaignStatus.PartialFailed;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 1000);
  }
  return 'Unknown newsletter delivery error';
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function formatCampaignStatus(status: PrismaNewsletterCampaignStatus): string {
  if (status === PrismaNewsletterCampaignStatus.Sent) return 'sent';
  if (status === PrismaNewsletterCampaignStatus.Failed) return 'failed';
  if (status === PrismaNewsletterCampaignStatus.PartialFailed) return 'partial_failed';
  return 'sending';
}

function buildCampaignSummaryNotificationMessage(
  subject: string,
  recipientsCount: number,
  sentCount: number,
  failedCount: number,
  status: PrismaNewsletterCampaignStatus,
): string {
  if (status === PrismaNewsletterCampaignStatus.Sent) {
    return `Рассылка «${subject}» завершена: отправлено ${sentCount} из ${recipientsCount}, ошибок ${failedCount}.`;
  }

  return `Рассылка «${subject}» завершена с ошибками: отправлено ${sentCount} из ${recipientsCount}, ошибок ${failedCount}.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

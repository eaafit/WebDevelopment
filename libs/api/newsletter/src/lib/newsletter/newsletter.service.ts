import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { Role, requireRole, type AccessTokenPayload } from '@internal/auth-shared';
import {
  MetricsService,
  type NewsletterAudienceMetricType,
  type NewsletterCampaignMetricStatus,
} from '@internal/metrics';
import { NotificationService } from '@internal/notification';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import {
  EstimateNewsletterAudienceResponseSchema,
  GetNewsletterCampaignResponseSchema,
  NewsletterAudienceType,
  NotificationType as RpcNotificationType,
  RepeatNewsletterCampaignResponseSchema,
  SendNewsletterCampaignResponseSchema,
  UserRole,
  type EstimateNewsletterAudienceRequest,
  type EstimateNewsletterAudienceResponse,
  type GetNewsletterCampaignRequest,
  type GetNewsletterCampaignResponse,
  type ListNewsletterCampaignsRequest,
  type ListNewsletterCampaignsResponse,
  type ListNewsletterSubscribersRequest,
  type ListNewsletterSubscribersResponse,
  type NewsletterAudience,
  type RepeatNewsletterCampaignRequest,
  type RepeatNewsletterCampaignResponse,
  type SendNewsletterCampaignRequest,
  type SendNewsletterCampaignResponse,
} from '@notary-portal/api-contracts';
import {
  NewsletterAudienceType as PrismaNewsletterAudienceType,
  NewsletterCampaignStatus as PrismaNewsletterCampaignStatus,
  Role as PrismaRole,
} from '@internal/prisma-client';
import { NEWSLETTER_MAILER, type NewsletterMailer } from './newsletter-mailer.interface';
import { NewsletterRepository, type NewsletterAudienceQuery } from './newsletter.repository';

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

type NewsletterCampaignAuditEventType =
  | 'newsletter.campaign.started'
  | 'newsletter.campaign.completed'
  | 'newsletter.campaign.repeat_started'
  | 'newsletter.campaign.repeat_completed';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly newsletterRepository: NewsletterRepository,
    @Inject(NEWSLETTER_MAILER) private readonly newsletterMailer: NewsletterMailer,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly metricsService: MetricsService,
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
      status: request.filters?.status
        ? this.newsletterRepository.toPrismaCampaignStatus(request.filters.status)
        : undefined,
    });
  }

  async getNewsletterCampaign(
    request: GetNewsletterCampaignRequest,
  ): Promise<GetNewsletterCampaignResponse> {
    requireRole(Role.Admin);
    const id = normalizeUuid(request.id, 'id');
    const campaign = await this.newsletterRepository.getCampaignDetail(id);

    if (!campaign) {
      throw new ConnectError('newsletter campaign not found', Code.NotFound);
    }

    return create(GetNewsletterCampaignResponseSchema, { campaign });
  }

  async estimateNewsletterAudience(
    request: EstimateNewsletterAudienceRequest,
  ): Promise<EstimateNewsletterAudienceResponse> {
    const actor = requireRole(Role.Admin);

    return runInSpan(
      'NewsletterService.estimateNewsletterAudience',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.newsletterAudienceEstimate,
        [NotarySpanAttributes.entity]: 'NewsletterAudience',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(actor.role),
      },
      async (span) => {
        const audience = this.normalizeAudience(request.audience);
        setSpanAttributes(span, { 'newsletter.audience_type': formatAudienceType(audience.type) });
        const recipients = await runInSpan(
          'NewsletterRepository.resolveAudience estimate',
          {
            'notary.operation': 'newsletter.audience.resolve',
            'notary.entity': 'NewsletterAudience',
            'newsletter.audience_type': formatAudienceType(audience.type),
          },
          () => this.newsletterRepository.resolveAudience(audience),
        );
        setSpanAttributes(span, { 'newsletter.recipient_count': recipients.length });

        return create(EstimateNewsletterAudienceResponseSchema, {
          recipientsCount: recipients.length,
        });
      },
    );
  }

  async sendNewsletterCampaign(
    request: SendNewsletterCampaignRequest,
  ): Promise<SendNewsletterCampaignResponse> {
    const actor = requireRole(Role.Admin);

    return runInSpan(
      'NewsletterService.sendNewsletterCampaign',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.newsletterCampaignSend,
        [NotarySpanAttributes.entity]: 'NewsletterCampaign',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(actor.role),
      },
      async (span) => {
        const audience = this.normalizeAudience(request.audience);
        const audienceMetricType = toMetricAudienceType(audience.type);
        const subject = normalizeRequiredString(request.subject, 'subject', MAX_SUBJECT_LENGTH);
        const bodyHtml = normalizeBodyHtml(request.bodyHtml);
        setSpanAttributes(span, { 'newsletter.audience_type': formatAudienceType(audience.type) });
        const recipients = await runInSpan(
          'NewsletterRepository.resolveAudience send',
          {
            'notary.operation': 'newsletter.audience.resolve',
            'notary.entity': 'NewsletterAudience',
            'newsletter.audience_type': formatAudienceType(audience.type),
          },
          () => this.newsletterRepository.resolveAudience(audience),
        );
        setSpanAttributes(span, { 'newsletter.recipient_count': recipients.length });

        if (!recipients.length) {
          throw new ConnectError('newsletter audience is empty', Code.FailedPrecondition);
        }

        const campaign = await runInSpan(
          'NewsletterRepository.createCampaign',
          {
            'notary.operation': 'newsletter.campaign.create',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.audience_type': formatAudienceType(audience.type),
            'newsletter.recipient_count': recipients.length,
            'newsletter.status': formatCampaignStatus(PrismaNewsletterCampaignStatus.Sending),
          },
          () =>
            this.newsletterRepository.createCampaign({
              createdById: isUuid(actor.sub) ? actor.sub : null,
              subject,
              bodyHtml,
              audience,
              audienceLabel: buildAudienceLabel(audience, recipients.length),
              recipients,
            }),
        );

        this.logCampaignStart(recipients.length);
        this.metricsService.recordNewsletterCampaignStarted(audienceMetricType, recipients.length);
        await this.recordCampaignAuditBestEffort({
          actor,
          campaign,
          eventType: 'newsletter.campaign.started',
          sentCount: 0,
          failedCount: 0,
          status: PrismaNewsletterCampaignStatus.Sending,
        });

        const delivery = await runInSpan(
          'NewsletterService.deliveryBatch',
          {
            'notary.operation': 'newsletter.delivery.batch',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.audience_type': formatAudienceType(audience.type),
            'newsletter.recipient_count': recipients.length,
          },
          async (deliverySpan) => {
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
                  this.metricsService.recordNewsletterDelivery('failed');
                  this.logDeliveryFailure(error);

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
                this.metricsService.recordNewsletterDelivery('sent');

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

            const status = resolveCampaignStatus(sentCount, failedCount, interruptedError !== null);
            setSpanAttributes(deliverySpan, {
              'newsletter.sent_count': sentCount,
              'newsletter.failed_count': failedCount,
              'newsletter.status': formatCampaignStatus(status),
            });
            if (interruptedError !== null || failedCount > 0) {
              markSpanFailure(
                deliverySpan,
                interruptedError ?? new Error('NewsletterDeliveryFailed'),
              );
            }
            return { sentCount, failedCount, interruptedError, status };
          },
        );

        const finalStatus = delivery.status;

        if (delivery.interruptedError) {
          this.logger.error(
            `Newsletter campaign interrupted; operation=newsletter.campaign.send; result=error; status=${formatCampaignStatus(finalStatus)}; sentCount=${delivery.sentCount}; failedCount=${delivery.failedCount}; error=${safeErrorName(delivery.interruptedError)}`,
          );
        }

        const completedCampaign = await runInSpan(
          'NewsletterRepository.completeCampaign',
          {
            'notary.operation': 'newsletter.campaign.complete',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.sent_count': delivery.sentCount,
            'newsletter.failed_count': delivery.failedCount,
            'newsletter.status': formatCampaignStatus(finalStatus),
          },
          () =>
            this.newsletterRepository.completeCampaign(campaign.id, {
              sentCount: delivery.sentCount,
              failedCount: delivery.failedCount,
              status: finalStatus,
            }),
        );

        this.logCampaignCompletion(finalStatus, delivery.sentCount, delivery.failedCount);
        this.metricsService.recordNewsletterCampaignCompleted(
          audienceMetricType,
          formatCampaignStatus(finalStatus) as NewsletterCampaignMetricStatus,
        );
        await this.recordCampaignAuditBestEffort({
          actor,
          campaign: completedCampaign,
          eventType: 'newsletter.campaign.completed',
          sentCount: delivery.sentCount,
          failedCount: delivery.failedCount,
          status: finalStatus,
        });
        await this.createCampaignSummaryNotificationBestEffort({
          actor,
          campaign: completedCampaign,
          sentCount: delivery.sentCount,
          failedCount: delivery.failedCount,
          status: finalStatus,
        });

        return create(SendNewsletterCampaignResponseSchema, {
          campaign: completedCampaign,
        });
      },
    );
  }

  async repeatNewsletterCampaign(
    request: RepeatNewsletterCampaignRequest,
  ): Promise<RepeatNewsletterCampaignResponse> {
    const actor = requireRole(Role.Admin);

    return runInSpan(
      'NewsletterService.repeatNewsletterCampaign',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.newsletterCampaignRepeat,
        [NotarySpanAttributes.entity]: 'NewsletterCampaign',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(actor.role),
        'newsletter.audience_type': 'selected',
      },
      async (span) => {
        const id = normalizeUuid(request.id, 'id');
        const source = await this.newsletterRepository.getCampaignForRepeat(id);

        if (!source) {
          throw new ConnectError('newsletter campaign not found', Code.NotFound);
        }
        if (!source.recipients.length) {
          throw new ConnectError('newsletter campaign has no recipients', Code.FailedPrecondition);
        }
        setSpanAttributes(span, { 'newsletter.recipient_count': source.recipients.length });

        const campaign = await runInSpan(
          'NewsletterRepository.createCampaign repeat',
          {
            'notary.operation': 'newsletter.campaign.create',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.audience_type': 'selected',
            'newsletter.recipient_count': source.recipients.length,
            'newsletter.status': formatCampaignStatus(PrismaNewsletterCampaignStatus.Sending),
          },
          () =>
            this.newsletterRepository.createCampaign({
              createdById: isUuid(actor.sub) ? actor.sub : null,
              subject: source.subject,
              bodyHtml: source.bodyHtml,
              audience: {
                type: PrismaNewsletterAudienceType.Selected,
                selectedUserIds: source.recipients
                  .map((recipient) => recipient.userId)
                  .filter((userId): userId is string => Boolean(userId)),
              },
              audienceLabel: `Повторная отправка (${source.recipients.length})`,
              recipients: source.recipients,
            }),
        );

        this.logCampaignStart(source.recipients.length, 'newsletter.campaign.repeat_started');
        await this.recordCampaignAuditBestEffort({
          actor,
          campaign,
          eventType: 'newsletter.campaign.repeat_started',
          sourceCampaignId: id,
          sentCount: 0,
          failedCount: 0,
          status: PrismaNewsletterCampaignStatus.Sending,
        });

        const delivery = await runInSpan(
          'NewsletterService.repeatDeliveryBatch',
          {
            'notary.operation': 'newsletter.delivery.batch',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.audience_type': 'selected',
            'newsletter.recipient_count': source.recipients.length,
          },
          async (deliverySpan) => {
            let sentCount = 0;
            let failedCount = 0;
            let interruptedError: unknown = null;

            try {
              for (const recipient of source.recipients) {
                try {
                  await this.newsletterMailer.sendNewsletterEmail({
                    to: recipient.email,
                    fullName: recipient.fullName,
                    subject: source.subject,
                    bodyHtml: source.bodyHtml,
                  });
                } catch (error) {
                  const deliveryErrorMessage = normalizeErrorMessage(error);
                  failedCount += 1;
                  this.logDeliveryFailure(error);

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

            const status = resolveCampaignStatus(sentCount, failedCount, interruptedError !== null);
            setSpanAttributes(deliverySpan, {
              'newsletter.sent_count': sentCount,
              'newsletter.failed_count': failedCount,
              'newsletter.status': formatCampaignStatus(status),
            });
            if (interruptedError !== null || failedCount > 0) {
              markSpanFailure(
                deliverySpan,
                interruptedError ?? new Error('NewsletterDeliveryFailed'),
              );
            }
            return { sentCount, failedCount, interruptedError, status };
          },
        );

        const finalStatus = delivery.status;

        if (delivery.interruptedError) {
          this.logger.error(
            `Newsletter campaign interrupted; operation=newsletter.campaign.repeat; result=error; status=${formatCampaignStatus(finalStatus)}; sentCount=${delivery.sentCount}; failedCount=${delivery.failedCount}; error=${safeErrorName(delivery.interruptedError)}`,
          );
        }

        const completedCampaign = await runInSpan(
          'NewsletterRepository.completeCampaign repeat',
          {
            'notary.operation': 'newsletter.campaign.complete',
            'notary.entity': 'NewsletterCampaign',
            'newsletter.sent_count': delivery.sentCount,
            'newsletter.failed_count': delivery.failedCount,
            'newsletter.status': formatCampaignStatus(finalStatus),
          },
          () =>
            this.newsletterRepository.completeCampaign(campaign.id, {
              sentCount: delivery.sentCount,
              failedCount: delivery.failedCount,
              status: finalStatus,
            }),
        );

        this.logCampaignCompletion(
          finalStatus,
          delivery.sentCount,
          delivery.failedCount,
          'newsletter.campaign.repeat_completed',
        );
        await this.recordCampaignAuditBestEffort({
          actor,
          campaign: completedCampaign,
          eventType: 'newsletter.campaign.repeat_completed',
          sourceCampaignId: id,
          sentCount: delivery.sentCount,
          failedCount: delivery.failedCount,
          status: finalStatus,
        });
        await this.createCampaignSummaryNotificationBestEffort({
          actor,
          campaign: completedCampaign,
          sentCount: delivery.sentCount,
          failedCount: delivery.failedCount,
          status: finalStatus,
        });

        return create(RepeatNewsletterCampaignResponseSchema, {
          campaign: completedCampaign,
        });
      },
    );
  }

  private logCampaignStart(
    recipientsCount: number,
    event:
      | 'newsletter.campaign.started'
      | 'newsletter.campaign.repeat_started' = 'newsletter.campaign.started',
  ): void {
    this.logger.log(
      JSON.stringify({
        event,
        recipientsCount,
      }),
    );
  }

  private logDeliveryFailure(error: unknown): void {
    this.logger.warn(
      JSON.stringify({
        event: 'newsletter.campaign.delivery_failed',
        result: 'error',
        error: safeErrorName(error),
      }),
    );
  }

  private logCampaignCompletion(
    status: PrismaNewsletterCampaignStatus,
    sentCount: number,
    failedCount: number,
    event:
      | 'newsletter.campaign.completed'
      | 'newsletter.campaign.repeat_completed' = 'newsletter.campaign.completed',
  ): void {
    this.logger.log(
      JSON.stringify({
        event,
        status: formatCampaignStatus(status),
        sentCount,
        failedCount,
      }),
    );
  }

  private async recordCampaignAuditBestEffort(input: {
    actor: AccessTokenPayload;
    campaign: NewsletterCampaignSummary;
    eventType: NewsletterCampaignAuditEventType;
    sourceCampaignId?: string;
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
        actionTitle: newsletterAuditTitle(input.eventType),
        actionContext: newsletterAuditContext(
          input.eventType,
          input.campaign.recipientsCount,
          input.sentCount,
          input.failedCount,
        ),
        targetTitle: input.campaign.subject,
        targetContext: input.campaign.audienceLabel,
        after: {
          ...(input.sourceCampaignId ? { sourceCampaignId: input.sourceCampaignId } : {}),
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
        `Newsletter audit failed; operation=audit.record; result=error; error=${safeErrorName(error)}`,
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
        `Newsletter notification failed; operation=notification.create; result=error; error=${safeErrorName(error)}`,
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
        throw new ConnectError(
          'audience.selected_user_ids must contain UUID values',
          Code.InvalidArgument,
        );
      }

      return { type, selectedUserIds };
    }

    return { type };
  }
}

function normalizePageLimit(value: number | undefined): number {
  const limit = normalizePositiveInt(value, DEFAULT_LIMIT);
  if (limit > MAX_PAGE_LIMIT) {
    throw new ConnectError(
      `pagination.limit must not exceed ${MAX_PAGE_LIMIT}`,
      Code.InvalidArgument,
    );
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
    throw new ConnectError(
      `${field} must not exceed ${maxLength} characters`,
      Code.InvalidArgument,
    );
  }
  return normalized;
}

function normalizeUuid(value: string, field: string): string {
  const normalized = value.trim();
  if (!isUuid(normalized)) {
    throw new ConnectError(`${field} must be a valid UUID`, Code.InvalidArgument);
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

function newsletterAuditTitle(eventType: NewsletterCampaignAuditEventType): string {
  if (eventType === 'newsletter.campaign.started') {
    return 'Запущена кампания рассылки';
  }
  if (eventType === 'newsletter.campaign.completed') {
    return 'Кампания рассылки завершена';
  }
  if (eventType === 'newsletter.campaign.repeat_started') {
    return 'Запущена повторная отправка рассылки';
  }
  return 'Повторная отправка рассылки завершена';
}

function newsletterAuditContext(
  eventType: NewsletterCampaignAuditEventType,
  recipientsCount: number,
  sentCount: number,
  failedCount: number,
): string {
  if (
    eventType === 'newsletter.campaign.started' ||
    eventType === 'newsletter.campaign.repeat_started'
  ) {
    return `Получателей: ${recipientsCount}`;
  }

  return `Отправлено: ${sentCount}, ошибок: ${failedCount}`;
}

function toMetricAudienceType(type: PrismaNewsletterAudienceType): NewsletterAudienceMetricType {
  if (type === PrismaNewsletterAudienceType.All) return 'all';
  if (type === PrismaNewsletterAudienceType.Role) return 'role';
  return 'selected';
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

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
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

function formatAudienceType(type: PrismaNewsletterAudienceType): string {
  if (type === PrismaNewsletterAudienceType.All) return 'all';
  if (type === PrismaNewsletterAudienceType.Role) return 'role';
  return 'selected';
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

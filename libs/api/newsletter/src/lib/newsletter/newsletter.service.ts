import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { Inject, Injectable } from '@nestjs/common';
import { Role, requireRole } from '@internal/auth-shared';
import {
  EstimateNewsletterAudienceResponseSchema,
  NewsletterAudienceType,
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

@Injectable()
export class NewsletterService {
  constructor(
    private readonly newsletterRepository: NewsletterRepository,
    @Inject(NEWSLETTER_MAILER) private readonly newsletterMailer: NewsletterMailer,
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
    const user = requireRole(Role.Admin);
    const audience = this.normalizeAudience(request.audience);
    const subject = normalizeRequiredString(request.subject, 'subject', MAX_SUBJECT_LENGTH);
    const bodyHtml = normalizeBodyHtml(request.bodyHtml);
    const recipients = await this.newsletterRepository.resolveAudience(audience);

    if (!recipients.length) {
      throw new ConnectError('newsletter audience is empty', Code.FailedPrecondition);
    }

    const campaign = await this.newsletterRepository.createCampaign({
      createdById: isUuid(user.sub) ? user.sub : null,
      subject,
      bodyHtml,
      audience,
      audienceLabel: buildAudienceLabel(audience, recipients.length),
      recipients,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        await this.newsletterMailer.sendNewsletterEmail({
          to: recipient.email,
          fullName: recipient.fullName,
          subject,
          bodyHtml,
        });
        await this.newsletterRepository.markDeliverySent(campaign.id, recipient.email);
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        await this.newsletterRepository.markDeliveryFailed(
          campaign.id,
          recipient.email,
          normalizeErrorMessage(error),
        );
      }
    }

    const finalStatus = resolveCampaignStatus(sentCount, failedCount);
    const completedCampaign = await this.newsletterRepository.completeCampaign(campaign.id, {
      sentCount,
      failedCount,
      status: finalStatus,
    });

    return create(SendNewsletterCampaignResponseSchema, {
      campaign: completedCampaign,
    });
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
): PrismaNewsletterCampaignStatus {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

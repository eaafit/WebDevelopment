import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import {
  NewsletterAudienceType as RpcNewsletterAudienceType,
  NewsletterCampaignDetailSchema,
  NewsletterCampaignSchema,
  NewsletterCampaignStatus as RpcNewsletterCampaignStatus,
  NewsletterDeliveryStatus as RpcNewsletterDeliveryStatus,
  NewsletterCampaignRecipientSchema,
  NewsletterSubscriberSchema,
  NewsletterSubscriberStatus as RpcNewsletterSubscriberStatus,
  PaginationMetaSchema,
  UserRole as RpcUserRole,
  type ListNewsletterCampaignsResponse,
  ListNewsletterCampaignsResponseSchema,
  type ListNewsletterSubscribersResponse,
  ListNewsletterSubscribersResponseSchema,
  type NewsletterCampaign,
  type NewsletterCampaignDetail,
  type NewsletterSubscriber,
} from '@notary-portal/api-contracts';
import {
  NewsletterAudienceType as PrismaNewsletterAudienceType,
  NewsletterCampaignStatus as PrismaNewsletterCampaignStatus,
  NewsletterDeliveryStatus as PrismaNewsletterDeliveryStatus,
  NewsletterSubscriptionStatus as PrismaNewsletterSubscriptionStatus,
  Prisma,
  Role as PrismaRole,
} from '@internal/prisma-client';

export interface NewsletterSubscriberQuery {
  page: number;
  limit: number;
  search?: string;
  status?: PrismaNewsletterSubscriptionStatus;
  role?: PrismaRole;
}

export interface NewsletterCampaignQuery {
  page: number;
  limit: number;
  search?: string;
  status?: PrismaNewsletterCampaignStatus;
}

export interface NewsletterAudienceQuery {
  type: PrismaNewsletterAudienceType;
  role?: PrismaRole;
  selectedUserIds?: string[];
}

export interface NewsletterRecipient {
  userId: string | null;
  email: string;
  fullName: string;
  role: PrismaRole;
}

export interface CreateNewsletterCampaignInput {
  createdById: string | null;
  subject: string;
  bodyHtml: string;
  audience: NewsletterAudienceQuery;
  audienceLabel: string;
  recipients: NewsletterRecipient[];
}

type SubscriberRow = Prisma.NewsletterSubscriptionGetPayload<{ include: { user: true } }>;
type CampaignRow = Prisma.NewsletterCampaignGetPayload<Record<string, never>>;
type CampaignDetailRow = Prisma.NewsletterCampaignGetPayload<{ include: { deliveries: true } }>;

@Injectable()
export class NewsletterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSubscribers(query: NewsletterSubscriberQuery): Promise<ListNewsletterSubscribersResponse> {
    const { page, limit } = query;
    const where = this.buildSubscriberWhere(query);

    const [totalItems, subscribers] = await this.prisma.$transaction([
      this.prisma.newsletterSubscription.count({ where }),
      this.prisma.newsletterSubscription.findMany({
        where,
        include: { user: true },
        orderBy: { subscribedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListNewsletterSubscribersResponseSchema, {
      subscribers: subscribers.map((subscriber) => this.toSubscriberMessage(subscriber)),
      meta: createPaginationMeta(totalItems, page, limit),
    });
  }

  async listCampaigns(query: NewsletterCampaignQuery): Promise<ListNewsletterCampaignsResponse> {
    const { page, limit } = query;
    const where = this.buildCampaignWhere(query);

    const [totalItems, campaigns] = await this.prisma.$transaction([
      this.prisma.newsletterCampaign.count({ where }),
      this.prisma.newsletterCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListNewsletterCampaignsResponseSchema, {
      campaigns: campaigns.map((campaign) => this.toCampaignMessage(campaign)),
      meta: createPaginationMeta(totalItems, page, limit),
    });
  }

  async getCampaignDetail(campaignId: string): Promise<NewsletterCampaignDetail | null> {
    const campaign = await this.prisma.newsletterCampaign.findUnique({
      where: { id: campaignId },
      include: {
        deliveries: {
          orderBy: { createdAt: 'asc' },
          take: 5,
        },
      },
    });

    return campaign ? this.toCampaignDetailMessage(campaign) : null;
  }

  async getCampaignForRepeat(campaignId: string): Promise<{
    subject: string;
    bodyHtml: string;
    recipients: NewsletterRecipient[];
  } | null> {
    const campaign = await this.prisma.newsletterCampaign.findUnique({
      where: { id: campaignId },
      include: {
        deliveries: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) return null;

    return {
      subject: campaign.subject,
      bodyHtml: campaign.bodyHtml,
      recipients: campaign.deliveries.map((delivery) => ({
        userId: delivery.userId,
        email: delivery.email,
        fullName: delivery.fullName,
        role: PrismaRole.Applicant,
      })),
    };
  }

  async resolveAudience(query: NewsletterAudienceQuery): Promise<NewsletterRecipient[]> {
    const where: Prisma.NewsletterSubscriptionWhereInput = {
      status: PrismaNewsletterSubscriptionStatus.Active,
      user: {
        isActive: true,
      },
    };

    if (query.type === PrismaNewsletterAudienceType.Role && query.role) {
      where.user = {
        isActive: true,
        role: query.role,
      };
    }

    if (query.type === PrismaNewsletterAudienceType.Selected) {
      where.userId = {
        in: query.selectedUserIds ?? [],
      };
    }

    const subscribers = await this.prisma.newsletterSubscription.findMany({
      where,
      include: { user: true },
      orderBy: { subscribedAt: 'desc' },
    });

    return subscribers.map((subscriber) => ({
      userId: subscriber.userId,
      email: subscriber.user.email,
      fullName: subscriber.user.fullName,
      role: subscriber.user.role,
    }));
  }

  async createCampaign(input: CreateNewsletterCampaignInput): Promise<NewsletterCampaign> {
    const campaign = await this.prisma.newsletterCampaign.create({
      data: {
        createdById: input.createdById,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        audienceType: input.audience.type,
        audienceRole: input.audience.role,
        audienceLabel: input.audienceLabel,
        recipientsCount: input.recipients.length,
        status: PrismaNewsletterCampaignStatus.Sending,
        deliveries: {
          create: input.recipients.map((recipient) => ({
            userId: recipient.userId,
            email: recipient.email,
            fullName: recipient.fullName,
            status: PrismaNewsletterDeliveryStatus.Pending,
          })),
        },
      },
    });

    return this.toCampaignMessage(campaign);
  }

  async markDeliverySent(campaignId: string, email: string): Promise<void> {
    await this.prisma.newsletterDelivery.updateMany({
      where: { campaignId, email },
      data: {
        status: PrismaNewsletterDeliveryStatus.Sent,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markDeliveryFailed(campaignId: string, email: string, errorMessage: string): Promise<void> {
    await this.prisma.newsletterDelivery.updateMany({
      where: { campaignId, email },
      data: {
        status: PrismaNewsletterDeliveryStatus.Failed,
        errorMessage,
      },
    });
  }

  async completeCampaign(
    campaignId: string,
    input: {
      sentCount: number;
      failedCount: number;
      status: PrismaNewsletterCampaignStatus;
    },
  ): Promise<NewsletterCampaign> {
    const campaign = await this.prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount: input.sentCount,
        failedCount: input.failedCount,
        status: input.status,
        completedAt: new Date(),
      },
    });

    return this.toCampaignMessage(campaign);
  }

  toPrismaRole(role: RpcUserRole): PrismaRole | undefined {
    const map: Partial<Record<RpcUserRole, PrismaRole>> = {
      [RpcUserRole.APPLICANT]: PrismaRole.Applicant,
      [RpcUserRole.NOTARY]: PrismaRole.Notary,
      [RpcUserRole.ADMIN]: PrismaRole.Admin,
    };

    return map[role];
  }

  toPrismaStatus(
    status: RpcNewsletterSubscriberStatus,
  ): PrismaNewsletterSubscriptionStatus | undefined {
    const map: Partial<Record<RpcNewsletterSubscriberStatus, PrismaNewsletterSubscriptionStatus>> =
      {
        [RpcNewsletterSubscriberStatus.ACTIVE]: PrismaNewsletterSubscriptionStatus.Active,
        [RpcNewsletterSubscriberStatus.UNSUBSCRIBED]:
          PrismaNewsletterSubscriptionStatus.Unsubscribed,
      };

    return map[status];
  }

  toPrismaAudienceType(type: RpcNewsletterAudienceType): PrismaNewsletterAudienceType | undefined {
    const map: Partial<Record<RpcNewsletterAudienceType, PrismaNewsletterAudienceType>> = {
      [RpcNewsletterAudienceType.ALL]: PrismaNewsletterAudienceType.All,
      [RpcNewsletterAudienceType.ROLE]: PrismaNewsletterAudienceType.Role,
      [RpcNewsletterAudienceType.SELECTED]: PrismaNewsletterAudienceType.Selected,
    };

    return map[type];
  }

  toPrismaCampaignStatus(
    status: RpcNewsletterCampaignStatus,
  ): PrismaNewsletterCampaignStatus | undefined {
    const map: Partial<Record<RpcNewsletterCampaignStatus, PrismaNewsletterCampaignStatus>> = {
      [RpcNewsletterCampaignStatus.SENDING]: PrismaNewsletterCampaignStatus.Sending,
      [RpcNewsletterCampaignStatus.SENT]: PrismaNewsletterCampaignStatus.Sent,
      [RpcNewsletterCampaignStatus.FAILED]: PrismaNewsletterCampaignStatus.Failed,
      [RpcNewsletterCampaignStatus.PARTIAL_FAILED]: PrismaNewsletterCampaignStatus.PartialFailed,
    };

    return map[status];
  }

  private buildSubscriberWhere(
    query: NewsletterSubscriberQuery,
  ): Prisma.NewsletterSubscriptionWhereInput {
    const where: Prisma.NewsletterSubscriptionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const userWhere: Prisma.UserWhereInput = {};
    if (query.role) {
      userWhere.role = query.role;
    }
    if (query.search) {
      userWhere.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(userWhere).length) {
      where.user = userWhere;
    }

    return where;
  }

  private buildCampaignWhere(query: NewsletterCampaignQuery): Prisma.NewsletterCampaignWhereInput {
    const search = query.search?.trim();
    const where: Prisma.NewsletterCampaignWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { audienceLabel: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private toSubscriberMessage(row: SubscriberRow): NewsletterSubscriber {
    return create(NewsletterSubscriberSchema, {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      fullName: row.user.fullName,
      role: this.fromPrismaRole(row.user.role),
      subscribedAt: timestampFromDate(row.subscribedAt),
      ...(row.unsubscribedAt && { unsubscribedAt: timestampFromDate(row.unsubscribedAt) }),
      status: this.fromPrismaStatus(row.status),
    });
  }

  private toCampaignMessage(row: CampaignRow): NewsletterCampaign {
    return create(NewsletterCampaignSchema, {
      id: row.id,
      createdAt: timestampFromDate(row.createdAt),
      ...(row.completedAt && { completedAt: timestampFromDate(row.completedAt) }),
      subject: row.subject,
      audienceType: this.fromPrismaAudienceType(row.audienceType),
      audienceLabel: row.audienceLabel,
      recipientsCount: row.recipientsCount,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      status: this.fromPrismaCampaignStatus(row.status),
    });
  }

  private toCampaignDetailMessage(row: CampaignDetailRow): NewsletterCampaignDetail {
    return create(NewsletterCampaignDetailSchema, {
      campaign: this.toCampaignMessage(row),
      previewText: toPreviewText(row.bodyHtml),
      recipients: row.deliveries.map((delivery) =>
        create(NewsletterCampaignRecipientSchema, {
          email: delivery.email,
          fullName: delivery.fullName,
          status: this.fromPrismaDeliveryStatus(delivery.status),
        }),
      ),
      bodyHtml: row.bodyHtml,
    });
  }

  private fromPrismaRole(role: PrismaRole): RpcUserRole {
    const map: Record<PrismaRole, RpcUserRole> = {
      [PrismaRole.Applicant]: RpcUserRole.APPLICANT,
      [PrismaRole.Notary]: RpcUserRole.NOTARY,
      [PrismaRole.Admin]: RpcUserRole.ADMIN,
    };
    return map[role];
  }

  private fromPrismaStatus(
    status: PrismaNewsletterSubscriptionStatus,
  ): RpcNewsletterSubscriberStatus {
    const map: Record<PrismaNewsletterSubscriptionStatus, RpcNewsletterSubscriberStatus> = {
      [PrismaNewsletterSubscriptionStatus.Active]: RpcNewsletterSubscriberStatus.ACTIVE,
      [PrismaNewsletterSubscriptionStatus.Unsubscribed]:
        RpcNewsletterSubscriberStatus.UNSUBSCRIBED,
    };
    return map[status];
  }

  private fromPrismaAudienceType(
    type: PrismaNewsletterAudienceType,
  ): RpcNewsletterAudienceType {
    const map: Record<PrismaNewsletterAudienceType, RpcNewsletterAudienceType> = {
      [PrismaNewsletterAudienceType.All]: RpcNewsletterAudienceType.ALL,
      [PrismaNewsletterAudienceType.Role]: RpcNewsletterAudienceType.ROLE,
      [PrismaNewsletterAudienceType.Selected]: RpcNewsletterAudienceType.SELECTED,
    };
    return map[type];
  }

  private fromPrismaCampaignStatus(
    status: PrismaNewsletterCampaignStatus,
  ): RpcNewsletterCampaignStatus {
    const map: Record<PrismaNewsletterCampaignStatus, RpcNewsletterCampaignStatus> = {
      [PrismaNewsletterCampaignStatus.Sending]: RpcNewsletterCampaignStatus.SENDING,
      [PrismaNewsletterCampaignStatus.Sent]: RpcNewsletterCampaignStatus.SENT,
      [PrismaNewsletterCampaignStatus.Failed]: RpcNewsletterCampaignStatus.FAILED,
      [PrismaNewsletterCampaignStatus.PartialFailed]:
        RpcNewsletterCampaignStatus.PARTIAL_FAILED,
    };
    return map[status];
  }

  private fromPrismaDeliveryStatus(
    status: PrismaNewsletterDeliveryStatus,
  ): RpcNewsletterDeliveryStatus {
    const map: Record<PrismaNewsletterDeliveryStatus, RpcNewsletterDeliveryStatus> = {
      [PrismaNewsletterDeliveryStatus.Pending]: RpcNewsletterDeliveryStatus.PENDING,
      [PrismaNewsletterDeliveryStatus.Sent]: RpcNewsletterDeliveryStatus.SENT,
      [PrismaNewsletterDeliveryStatus.Failed]: RpcNewsletterDeliveryStatus.FAILED,
    };
    return map[status];
  }
}

function createPaginationMeta(totalItems: number, page: number, limit: number) {
  return create(PaginationMetaSchema, {
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    currentPage: page,
    perPage: limit,
  });
}

function toPreviewText(bodyHtml: string): string {
  return bodyHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

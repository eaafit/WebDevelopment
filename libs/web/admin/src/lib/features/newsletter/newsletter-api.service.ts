import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  NewsletterAudienceType,
  NewsletterDeliveryStatus as RpcNewsletterDeliveryStatus,
  NewsletterCampaignStatus as RpcNewsletterCampaignStatus,
  NewsletterService,
  NewsletterSubscriberStatus,
  UserRole as RpcUserRole,
  type NewsletterCampaign,
  type NewsletterCampaignDetail,
  type NewsletterSubscriber,
  type PaginationMeta,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import type {
  NewsletterAudienceInput,
  NewsletterCampaignStatus,
  NewsletterCampaignDetailView,
  NewsletterCampaignStatusFilter,
  NewsletterCampaignRecipientView,
  NewsletterCampaignView,
  NewsletterPagination,
  NewsletterRoleFilter,
  NewsletterSubscriberStatusFilter,
  NewsletterSubscriberView,
} from './newsletter.models';

const DEFAULT_META: NewsletterPagination = {
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  perPage: 20,
};

@Injectable({ providedIn: 'root' })
export class NewsletterApiService {
  private readonly client = createClient(NewsletterService, inject(RPC_TRANSPORT));

  async listSubscribers(params: {
    page: number;
    limit: number;
    query: string;
    status: NewsletterSubscriberStatusFilter;
    role: NewsletterRoleFilter;
  }): Promise<{ subscribers: NewsletterSubscriberView[]; meta: NewsletterPagination }> {
    const response = await this.client.listNewsletterSubscribers({
      pagination: { page: params.page, limit: params.limit },
      filters: {
        query: params.query.trim(),
        status: toRpcSubscriberStatus(params.status),
        role: toRpcRole(params.role),
      },
    });

    return {
      subscribers: response.subscribers.map(toSubscriberView),
      meta: toPagination(response.meta),
    };
  }

  async listCampaigns(params: {
    page: number;
    limit: number;
    query: string;
    status?: NewsletterCampaignStatusFilter;
  }): Promise<{ campaigns: NewsletterCampaignView[]; meta: NewsletterPagination }> {
    const response = await this.client.listNewsletterCampaigns({
      pagination: { page: params.page, limit: params.limit },
      filters: {
        query: params.query.trim(),
        status: toRpcCampaignStatus(params.status ?? 'all'),
      },
    });

    return {
      campaigns: response.campaigns.map(toCampaignView),
      meta: toPagination(response.meta),
    };
  }

  async getCampaign(id: string): Promise<NewsletterCampaignDetailView> {
    const response = await this.client.getNewsletterCampaign({ id });

    if (!response.campaign) {
      throw new Error('API вернул пустые детали рассылки.');
    }

    return toCampaignDetailView(response.campaign);
  }

  async repeatCampaign(id: string): Promise<NewsletterCampaignView> {
    const response = await this.client.repeatNewsletterCampaign({ id });

    if (!response.campaign) {
      throw new Error('API вернул пустую повторную рассылку.');
    }

    return toCampaignView(response.campaign);
  }

  async estimateAudience(audience: NewsletterAudienceInput): Promise<number> {
    const response = await this.client.estimateNewsletterAudience({
      audience: toRpcAudience(audience),
    });

    return response.recipientsCount;
  }

  async sendCampaign(params: {
    audience: NewsletterAudienceInput;
    subject: string;
    bodyHtml: string;
  }): Promise<NewsletterCampaignView> {
    const response = await this.client.sendNewsletterCampaign({
      audience: toRpcAudience(params.audience),
      subject: params.subject.trim(),
      bodyHtml: params.bodyHtml.trim(),
    });

    if (!response.campaign) {
      throw new Error('API вернул пустую кампанию рассылки.');
    }

    return toCampaignView(response.campaign);
  }
}

function toRpcAudience(audience: NewsletterAudienceInput) {
  if (audience.mode === 'role') {
    return {
      type: NewsletterAudienceType.ROLE,
      role: toRpcRole(audience.role),
      selectedUserIds: [],
    };
  }

  if (audience.mode === 'selected') {
    return {
      type: NewsletterAudienceType.SELECTED,
      role: RpcUserRole.UNSPECIFIED,
      selectedUserIds: audience.selectedUserIds,
    };
  }

  return {
    type: NewsletterAudienceType.ALL,
    role: RpcUserRole.UNSPECIFIED,
    selectedUserIds: [],
  };
}

function toSubscriberView(subscriber: NewsletterSubscriber): NewsletterSubscriberView {
  const role = fromRpcRole(subscriber.role);
  const status = fromRpcSubscriberStatus(subscriber.status);

  return {
    id: subscriber.id,
    userId: subscriber.userId,
    email: subscriber.email,
    fullName: subscriber.fullName,
    role,
    roleLabel: roleLabel(role),
    subscribedAt: formatTimestamp(subscriber.subscribedAt),
    unsubscribedAt: formatTimestamp(subscriber.unsubscribedAt),
    status,
    statusLabel: status === 'active' ? 'Активна' : 'Отписан',
  };
}

function toCampaignView(campaign: NewsletterCampaign): NewsletterCampaignView {
  const status = fromRpcCampaignStatus(campaign.status);

  return {
    id: campaign.id,
    createdAt: formatTimestamp(campaign.createdAt),
    completedAt: formatTimestamp(campaign.completedAt),
    subject: campaign.subject,
    audienceLabel: campaign.audienceLabel,
    recipientsCount: campaign.recipientsCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    status,
    statusLabel: campaignStatusLabel(status),
  };
}

function toPagination(meta: PaginationMeta | undefined): NewsletterPagination {
  if (!meta) return DEFAULT_META;
  return {
    totalItems: meta.totalItems,
    totalPages: Math.max(1, meta.totalPages),
    currentPage: Math.max(1, meta.currentPage),
    perPage: Math.max(1, meta.perPage),
  };
}

function toRpcSubscriberStatus(status: NewsletterSubscriberStatusFilter): NewsletterSubscriberStatus {
  if (status === 'active') return NewsletterSubscriberStatus.ACTIVE;
  if (status === 'unsubscribed') return NewsletterSubscriberStatus.UNSUBSCRIBED;
  return NewsletterSubscriberStatus.UNSPECIFIED;
}

function fromRpcSubscriberStatus(
  status: NewsletterSubscriberStatus,
): Exclude<NewsletterSubscriberStatusFilter, 'all'> {
  return status === NewsletterSubscriberStatus.UNSUBSCRIBED ? 'unsubscribed' : 'active';
}

function toRpcRole(role: NewsletterRoleFilter): RpcUserRole {
  if (role === 'applicant') return RpcUserRole.APPLICANT;
  if (role === 'notary') return RpcUserRole.NOTARY;
  if (role === 'admin') return RpcUserRole.ADMIN;
  return RpcUserRole.UNSPECIFIED;
}

function fromRpcRole(role: RpcUserRole): Exclude<NewsletterRoleFilter, 'all'> {
  if (role === RpcUserRole.NOTARY) return 'notary';
  if (role === RpcUserRole.ADMIN) return 'admin';
  return 'applicant';
}

function toRpcCampaignStatus(status: NewsletterCampaignStatusFilter): RpcNewsletterCampaignStatus {
  if (status === 'sending') return RpcNewsletterCampaignStatus.SENDING;
  if (status === 'sent') return RpcNewsletterCampaignStatus.SENT;
  if (status === 'failed') return RpcNewsletterCampaignStatus.FAILED;
  if (status === 'partialFailed') return RpcNewsletterCampaignStatus.PARTIAL_FAILED;
  return RpcNewsletterCampaignStatus.UNSPECIFIED;
}

function fromRpcCampaignStatus(status: RpcNewsletterCampaignStatus): NewsletterCampaignStatus {
  if (status === RpcNewsletterCampaignStatus.FAILED) return 'failed';
  if (status === RpcNewsletterCampaignStatus.PARTIAL_FAILED) return 'partialFailed';
  if (status === RpcNewsletterCampaignStatus.SENDING) return 'sending';
  return 'sent';
}

function toCampaignDetailView(detail: NewsletterCampaignDetail): NewsletterCampaignDetailView {
  if (!detail.campaign) {
    throw new Error('API вернул детали рассылки без кампании.');
  }

  return {
    campaign: toCampaignView(detail.campaign),
    previewText: detail.previewText,
    recipients: detail.recipients.map(toRecipientView),
  };
}

function toRecipientView(
  recipient: NewsletterCampaignDetail['recipients'][number],
): NewsletterCampaignRecipientView {
  const status = fromRpcDeliveryStatus(recipient.status);

  return {
    email: recipient.email,
    fullName: recipient.fullName,
    status,
    statusLabel: deliveryStatusLabel(status),
  };
}

function fromRpcDeliveryStatus(
  status: RpcNewsletterDeliveryStatus,
): NewsletterCampaignRecipientView['status'] {
  if (status === RpcNewsletterDeliveryStatus.FAILED) return 'failed';
  if (status === RpcNewsletterDeliveryStatus.PENDING) return 'pending';
  return 'sent';
}

function roleLabel(role: Exclude<NewsletterRoleFilter, 'all'>): string {
  if (role === 'notary') return 'Нотариус';
  if (role === 'admin') return 'Администратор';
  return 'Заявитель';
}

function campaignStatusLabel(status: NewsletterCampaignStatus): string {
  if (status === 'failed') return 'Ошибка';
  if (status === 'partialFailed') return 'Частично отправлена';
  if (status === 'sending') return 'Отправляется';
  return 'Отправлена';
}

function deliveryStatusLabel(status: NewsletterCampaignRecipientView['status']): string {
  if (status === 'failed') return 'Ошибка';
  if (status === 'pending') return 'Ожидает';
  return 'Отправлено';
}

function formatTimestamp(timestamp: NewsletterCampaign['createdAt']): string {
  if (!timestamp) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestampDate(timestamp));
}

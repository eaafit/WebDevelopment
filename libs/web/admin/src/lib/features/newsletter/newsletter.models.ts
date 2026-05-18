export type NewsletterSubscriberStatusFilter = 'all' | 'active' | 'unsubscribed';
export type NewsletterRoleFilter = 'all' | 'applicant' | 'notary' | 'admin';
export type NewsletterAudienceMode = 'all' | 'role' | 'selected';
export type NewsletterCampaignStatus = 'sending' | 'sent' | 'failed' | 'partialFailed';
export type NewsletterCampaignStatusFilter = NewsletterCampaignStatus | 'all';

export interface NewsletterPagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface NewsletterSubscriberView {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: Exclude<NewsletterRoleFilter, 'all'>;
  roleLabel: string;
  subscribedAt: string;
  unsubscribedAt: string;
  status: Exclude<NewsletterSubscriberStatusFilter, 'all'>;
  statusLabel: string;
}

export interface NewsletterCampaignView {
  id: string;
  createdAt: string;
  completedAt: string;
  subject: string;
  audienceLabel: string;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  status: NewsletterCampaignStatus;
  statusLabel: string;
}

export interface NewsletterCampaignDetailView {
  campaign: NewsletterCampaignView;
  previewText: string;
  bodyHtml: string;
  recipients: NewsletterCampaignRecipientView[];
}

export interface NewsletterCampaignRecipientView {
  email: string;
  fullName: string;
  status: 'pending' | 'sent' | 'failed';
  statusLabel: string;
}

export interface NewsletterAudienceInput {
  mode: NewsletterAudienceMode;
  role: Exclude<NewsletterRoleFilter, 'all'>;
  selectedUserIds: string[];
}

export interface NewsletterDraftTemplate {
  subject: string;
  bodyHtml: string;
  sourceCampaignId: string;
}

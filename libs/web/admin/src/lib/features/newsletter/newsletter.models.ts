export type NewsletterSubscriberStatusFilter = 'all' | 'active' | 'unsubscribed';
export type NewsletterRoleFilter = 'all' | 'applicant' | 'notary' | 'admin';
export type NewsletterAudienceMode = 'all' | 'role' | 'selected';
export type NewsletterCampaignStatus = 'sending' | 'sent' | 'failed' | 'partialFailed';

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

export interface NewsletterAudienceInput {
  mode: NewsletterAudienceMode;
  role: Exclude<NewsletterRoleFilter, 'all'>;
  selectedUserIds: string[];
}

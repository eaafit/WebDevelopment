import { Injectable } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import type {
  EstimateNewsletterAudienceRequest,
  EstimateNewsletterAudienceResponse,
  GetNewsletterCampaignRequest,
  GetNewsletterCampaignResponse,
  ListNewsletterCampaignsRequest,
  ListNewsletterCampaignsResponse,
  ListNewsletterSubscribersRequest,
  ListNewsletterSubscribersResponse,
  RepeatNewsletterCampaignRequest,
  RepeatNewsletterCampaignResponse,
  SendNewsletterCampaignRequest,
  SendNewsletterCampaignResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class NewsletterRpcService {
  constructor(private readonly newsletterService: NewsletterService) {}

  readonly listNewsletterSubscribers = (
    request: ListNewsletterSubscribersRequest,
  ): Promise<ListNewsletterSubscribersResponse> =>
    this.newsletterService.listNewsletterSubscribers(request);

  readonly estimateNewsletterAudience = (
    request: EstimateNewsletterAudienceRequest,
  ): Promise<EstimateNewsletterAudienceResponse> =>
    this.newsletterService.estimateNewsletterAudience(request);

  readonly sendNewsletterCampaign = (
    request: SendNewsletterCampaignRequest,
  ): Promise<SendNewsletterCampaignResponse> =>
    this.newsletterService.sendNewsletterCampaign(request);

  readonly listNewsletterCampaigns = (
    request: ListNewsletterCampaignsRequest,
  ): Promise<ListNewsletterCampaignsResponse> =>
    this.newsletterService.listNewsletterCampaigns(request);

  readonly getNewsletterCampaign = (
    request: GetNewsletterCampaignRequest,
  ): Promise<GetNewsletterCampaignResponse> =>
    this.newsletterService.getNewsletterCampaign(request);

  readonly repeatNewsletterCampaign = (
    request: RepeatNewsletterCampaignRequest,
  ): Promise<RepeatNewsletterCampaignResponse> =>
    this.newsletterService.repeatNewsletterCampaign(request);
}

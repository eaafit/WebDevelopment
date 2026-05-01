import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  EstimateNewsletterAudienceRequestSchema,
  ListNewsletterSubscribersRequestSchema,
  NewsletterAudienceType,
  NewsletterCampaignSchema,
  NewsletterCampaignStatus,
  NewsletterSubscriberStatus,
  SendNewsletterCampaignRequestSchema,
  UserRole,
} from '@notary-portal/api-contracts';
import {
  Role,
  requestContextStorage,
  type AccessTokenPayload,
} from '@internal/auth-shared';
import {
  NewsletterAudienceType as PrismaNewsletterAudienceType,
  NewsletterCampaignStatus as PrismaNewsletterCampaignStatus,
  NewsletterSubscriptionStatus as PrismaNewsletterSubscriptionStatus,
  Role as PrismaRole,
} from '@internal/prisma-client';
import { NewsletterService } from './newsletter.service';

describe('NewsletterService', () => {
  const repository = {
    listSubscribers: jest.fn(),
    listCampaigns: jest.fn(),
    resolveAudience: jest.fn(),
    createCampaign: jest.fn(),
    markDeliverySent: jest.fn(),
    markDeliveryFailed: jest.fn(),
    completeCampaign: jest.fn(),
    toPrismaStatus: jest.fn(),
    toPrismaRole: jest.fn(),
    toPrismaAudienceType: jest.fn(),
  };
  const mailer = {
    sendNewsletterEmail: jest.fn(),
  };
  const service = new NewsletterService(repository as never, mailer);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.toPrismaStatus.mockImplementation((status) =>
      status === NewsletterSubscriberStatus.UNSUBSCRIBED
        ? PrismaNewsletterSubscriptionStatus.Unsubscribed
        : status === NewsletterSubscriberStatus.ACTIVE
          ? PrismaNewsletterSubscriptionStatus.Active
          : undefined,
    );
    repository.toPrismaRole.mockImplementation((role) =>
      role === UserRole.NOTARY
        ? PrismaRole.Notary
        : role === UserRole.ADMIN
          ? PrismaRole.Admin
          : role === UserRole.APPLICANT
            ? PrismaRole.Applicant
            : undefined,
    );
    repository.toPrismaAudienceType.mockImplementation((type) =>
      type === NewsletterAudienceType.ALL
        ? PrismaNewsletterAudienceType.All
        : type === NewsletterAudienceType.ROLE
          ? PrismaNewsletterAudienceType.Role
          : type === NewsletterAudienceType.SELECTED
            ? PrismaNewsletterAudienceType.Selected
            : undefined,
    );
    repository.listSubscribers.mockResolvedValue({ subscribers: [], meta: undefined });
    repository.listCampaigns.mockResolvedValue({ campaigns: [], meta: undefined });
    repository.createCampaign.mockResolvedValue(
      create(NewsletterCampaignSchema, {
        id: '11111111-1111-4111-a111-111111111111',
      }),
    );
    repository.completeCampaign.mockImplementation((_id, input) =>
      create(NewsletterCampaignSchema, {
        id: '11111111-1111-4111-a111-111111111111',
        subject: 'Тестовая рассылка',
        recipientsCount: input.sentCount + input.failedCount,
        sentCount: input.sentCount,
        failedCount: input.failedCount,
        status: toRpcCampaignStatus(input.status),
      }),
    );
    repository.markDeliverySent.mockResolvedValue(undefined);
    repository.markDeliveryFailed.mockResolvedValue(undefined);
    mailer.sendNewsletterEmail.mockResolvedValue(undefined);
  });

  it('normalizes subscriber search, role, status and pagination for admins', async () => {
    await runAs(adminUser(), () =>
      service.listNewsletterSubscribers(
        create(ListNewsletterSubscribersRequestSchema, {
          pagination: { page: 2, limit: 30 },
          filters: {
            query: ' notary@example.com ',
            status: NewsletterSubscriberStatus.ACTIVE,
            role: UserRole.NOTARY,
          },
        }),
      ),
    );

    expect(repository.listSubscribers).toHaveBeenCalledWith({
      page: 2,
      limit: 30,
      search: 'notary@example.com',
      status: PrismaNewsletterSubscriptionStatus.Active,
      role: PrismaRole.Notary,
    });
  });

  it('rejects non-admin access', async () => {
    expect(() =>
      runAs(
        { ...adminUser(), role: Role.Notary },
        () =>
          service.listNewsletterSubscribers(
            create(ListNewsletterSubscribersRequestSchema, {
              pagination: { page: 1, limit: 20 },
            }),
          ),
      ),
    ).toThrow(ConnectError);
  });

  it('estimates selected active recipients through the repository', async () => {
    repository.resolveAudience.mockResolvedValue([recipient('a@example.com')]);

    const response = await runAs(adminUser(), () =>
      service.estimateNewsletterAudience(
        create(EstimateNewsletterAudienceRequestSchema, {
          audience: {
            type: NewsletterAudienceType.SELECTED,
            role: UserRole.UNSPECIFIED,
            selectedUserIds: ['11111111-1111-4111-a111-111111111111'],
          },
        }),
      ),
    );

    expect(response.recipientsCount).toBe(1);
    expect(repository.resolveAudience).toHaveBeenCalledWith({
      type: PrismaNewsletterAudienceType.Selected,
      selectedUserIds: ['11111111-1111-4111-a111-111111111111'],
    });
  });

  it('sends a campaign and marks all deliveries as sent', async () => {
    repository.resolveAudience.mockResolvedValue([
      recipient('a@example.com'),
      recipient('b@example.com'),
    ]);

    const response = await runAs(adminUser(), () =>
      service.sendNewsletterCampaign(validSendRequest()),
    );

    expect(mailer.sendNewsletterEmail).toHaveBeenCalledTimes(2);
    expect(repository.markDeliverySent).toHaveBeenCalledTimes(2);
    expect(repository.markDeliveryFailed).not.toHaveBeenCalled();
    expect(repository.completeCampaign).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      {
        sentCount: 2,
        failedCount: 0,
        status: PrismaNewsletterCampaignStatus.Sent,
      },
    );
    expect(response.campaign?.sentCount).toBe(2);
  });

  it('records a partial failure when one delivery fails', async () => {
    repository.resolveAudience.mockResolvedValue([
      recipient('a@example.com'),
      recipient('b@example.com'),
    ]);
    mailer.sendNewsletterEmail.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
      new Error('SMTP rejected recipient'),
    );

    await runAs(adminUser(), () => service.sendNewsletterCampaign(validSendRequest()));

    expect(repository.markDeliverySent).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      'a@example.com',
    );
    expect(repository.markDeliveryFailed).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      'b@example.com',
      'SMTP rejected recipient',
    );
    expect(repository.completeCampaign).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      {
        sentCount: 1,
        failedCount: 1,
        status: PrismaNewsletterCampaignStatus.PartialFailed,
      },
    );
  });

  it('marks campaign as failed when all deliveries fail', async () => {
    repository.resolveAudience.mockResolvedValue([recipient('a@example.com')]);
    mailer.sendNewsletterEmail.mockRejectedValue(new Error('SMTP unavailable'));

    await runAs(adminUser(), () => service.sendNewsletterCampaign(validSendRequest()));

    expect(repository.completeCampaign).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      {
        sentCount: 0,
        failedCount: 1,
        status: PrismaNewsletterCampaignStatus.Failed,
      },
    );
  });

  it('rejects empty audience and invalid body before sending', async () => {
    repository.resolveAudience.mockResolvedValue([]);

    await expect(runAs(adminUser(), () => service.sendNewsletterCampaign(validSendRequest()))).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    });
    await expect(
      runAs(adminUser(), () =>
        service.sendNewsletterCampaign(
          create(SendNewsletterCampaignRequestSchema, {
            audience: { type: NewsletterAudienceType.ALL },
            subject: ' ',
            bodyHtml: ' ',
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(ConnectError);
    expect(mailer.sendNewsletterEmail).not.toHaveBeenCalled();
  });
});

function validSendRequest() {
  return create(SendNewsletterCampaignRequestSchema, {
    audience: { type: NewsletterAudienceType.ALL },
    subject: 'Тестовая рассылка',
    bodyHtml: '<p>Текст письма</p>',
  });
}

function recipient(email: string) {
  return {
    userId: '11111111-1111-4111-a111-111111111111',
    email,
    fullName: 'Тестовый пользователь',
    role: PrismaRole.Applicant,
  };
}

function toRpcCampaignStatus(status: PrismaNewsletterCampaignStatus): NewsletterCampaignStatus {
  if (status === PrismaNewsletterCampaignStatus.Failed) return NewsletterCampaignStatus.FAILED;
  if (status === PrismaNewsletterCampaignStatus.PartialFailed) {
    return NewsletterCampaignStatus.PARTIAL_FAILED;
  }
  return NewsletterCampaignStatus.SENT;
}

function adminUser(): AccessTokenPayload {
  return {
    sub: '11111111-1111-4111-a111-111111111111',
    email: 'admin@example.com',
    role: Role.Admin,
    iat: 1,
    exp: 2,
  };
}

function runAs<T>(user: AccessTokenPayload, callback: () => T): T {
  return requestContextStorage.run(
    {
      user,
      metadata: { ip: null, userAgent: null },
    },
    callback,
  );
}

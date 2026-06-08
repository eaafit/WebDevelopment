import type { Span } from '@opentelemetry/api';
import { Logger } from '@nestjs/common';
import { requestContextStorage } from '@internal/auth-shared';
import type { PrismaService } from '@internal/prisma';
import {
  BusinessOperations,
  NotarySpanAttributes,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import { OrderService } from './order.service';

jest.mock('@internal/tracing', () => {
  const actual = jest.requireActual<typeof import('@internal/tracing')>('@internal/tracing');

  return {
    ...actual,
    runInSpan: jest.fn(
      async (
        _spanName: string,
        _attributes: Record<string, unknown>,
        action: (span: Span) => unknown | Promise<unknown>,
      ) => action({} as Span),
    ),
    setSpanAttributes: jest.fn(),
  };
});

type PrismaMock = {
  lead: {
    count: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  assessment: {
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('OrderService', () => {
  let service: OrderService;
  let prisma: PrismaMock;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const runInSpanMock = jest.mocked(runInSpan);
  const setSpanAttributesMock = jest.mocked(setSpanAttributes);

  beforeEach(() => {
    prisma = {
      lead: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      assessment: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback: (tx: PrismaMock) => Promise<unknown>) =>
      callback(prisma),
    );

    service = new OrderService(prisma as unknown as PrismaService);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists applicant orders and traces only safe low-cardinality attributes', async () => {
    prisma.lead.count.mockResolvedValue(1);
    prisma.lead.findMany.mockResolvedValue([buildLead({ assessment: { status: 'New' } })]);

    const result = await requestContextStorage.run(
      {
        user: {
          sub: 'user-1',
          email: 'applicant@example.com',
          role: 'USER_ROLE_APPLICANT',
          iat: 1,
          exp: 2,
        },
        metadata: { ip: null, userAgent: null },
      },
      () =>
        service.findMany({
          userId: 'user-1',
          role: 'applicant',
          status: 'created',
          page: 1,
          pageSize: 25,
        }),
    );

    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: {
        applicantId: 'user-1',
        assessment: { status: 'New' },
      },
    });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicantId: 'user-1',
          assessment: { status: 'New' },
        },
        skip: 0,
        take: 25,
        orderBy: { startDate: 'desc' },
      }),
    );
    expect(result).toMatchObject({
      total: 1,
      totalPages: 1,
      orders: [
        {
          id: 'lead-1',
          assessmentId: 'assessment-1',
          status: 'created',
        },
      ],
    });

    expect(runInSpanMock).toHaveBeenCalledWith(
      'OrderService.findMany',
      expect.objectContaining({
        [NotarySpanAttributes.operation]: BusinessOperations.orderList,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: 'applicant',
        'order.filter.has_status': true,
        'order.page_size': 25,
      }),
      expect.any(Function),
    );
    const rootAttributes = runInSpanMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rootAttributes).not.toHaveProperty('user.id');
    expect(rootAttributes).not.toHaveProperty('order.id');
    expect(rootAttributes).not.toHaveProperty('order.search_query');
    expect(setSpanAttributesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'order.result_count': 1,
        'order.total_count': 1,
        'order.total_pages': 1,
      }),
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('uses the authenticated actor role instead of the list filter role', async () => {
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);

    await requestContextStorage.run(
      {
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          role: 'USER_ROLE_ADMIN',
          iat: 1,
          exp: 2,
        },
        metadata: { ip: null, userAgent: null },
      },
      () =>
        service.findMany({
          userId: 'user-1',
          role: 'applicant',
          page: 1,
          pageSize: 25,
        }),
    );

    expect(runInSpanMock).toHaveBeenCalledWith(
      'OrderService.findMany',
      expect.objectContaining({
        [NotarySpanAttributes.actorRole]: 'admin',
      }),
      expect.any(Function),
    );
  });

  it('takes a new order, verifies the assessment, and traces the status transition', async () => {
    prisma.lead.findUnique.mockResolvedValue(buildLead({ assessment: { status: 'New' } }));
    prisma.lead.update.mockResolvedValue(
      buildLead({
        executorId: 'notary-1',
        executor: { id: 'notary-1', fullName: 'Notary One' },
        assessment: { status: 'New' },
      }),
    );
    prisma.assessment.update.mockResolvedValue({ id: 'assessment-1', status: 'Verified' });

    const result = await requestContextStorage.run(
      {
        user: {
          sub: 'notary-1',
          email: 'notary@example.com',
          role: 'USER_ROLE_NOTARY',
          iat: 1,
          exp: 2,
        },
        metadata: { ip: null, userAgent: null },
      },
      () => service.takeOrder('lead-1', 'notary-1'),
    );

    expect(prisma.lead.findUnique).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      include: { assessment: true },
    });
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({
          executorId: 'notary-1',
          plannedCompletionDate: expect.any(Date),
        }),
      }),
    );
    expect(prisma.assessment.update).toHaveBeenCalledWith({
      where: { id: 'assessment-1' },
      data: { status: 'Verified' },
    });
    expect(result).toMatchObject({
      id: 'lead-1',
      notaryId: 'notary-1',
      status: 'accepted',
    });

    expect(runInSpanMock).toHaveBeenCalledWith(
      'OrderService.takeOrder',
      expect.objectContaining({
        [NotarySpanAttributes.operation]: BusinessOperations.orderTake,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: 'notary',
      }),
      expect.any(Function),
    );
    expect(setSpanAttributesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'order.has_executor': false,
        'assessment.status.from': 'New',
      }),
    );
    expect(setSpanAttributesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'assessment.status.to': 'Verified',
      }),
    );
  });

  it('logs findMany errors without raw params, ids, address, names or error object', async () => {
    const error = Object.assign(new Error('database failed'), {
      userId: 'user-unsafe-1',
      orderSample: {
        id: 'lead-unsafe-1',
        applicantName: 'Applicant Private',
        objectAddress: 'Secret Street 42',
      },
    });
    prisma.lead.count.mockRejectedValue(error);

    await expect(
      service.findMany({
        userId: 'user-unsafe-1',
        role: 'applicant',
        status: 'created',
        searchQuery: 'Secret Street',
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toThrow(error);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith({
      operation: 'findMany',
      result: 'error',
      error: 'Error',
    });
    const loggedPayload = JSON.stringify(loggerErrorSpy.mock.calls);
    expect(loggedPayload).not.toContain('user-unsafe-1');
    expect(loggedPayload).not.toContain('lead-unsafe-1');
    expect(loggedPayload).not.toContain('Applicant Private');
    expect(loggedPayload).not.toContain('Secret Street');
  });
});

function buildLead(
  overrides: {
    executorId?: string | null;
    executor?: { id: string; fullName: string } | null;
    assessment?: { status: string };
  } = {},
) {
  return {
    id: 'lead-1',
    assessmentId: 'assessment-1',
    applicantId: 'user-1',
    executorId: overrides.executorId ?? null,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    plannedCompletionDate: null,
    actualCompletionDate: null,
    transactionId: null,
    applicant: { id: 'user-1', fullName: 'Applicant One' },
    executor: overrides.executor ?? null,
    assessment: {
      id: 'assessment-1',
      status: overrides.assessment?.status ?? 'New',
      address: 'Safe test address',
      estimatedValue: '1000000',
      realEstateObject: null,
    },
  };
}

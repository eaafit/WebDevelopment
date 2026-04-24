import { UserRole as RpcUserRole } from '@notary-portal/api-contracts';
import { Role as PrismaRole } from '@internal/prisma-client';
import { AuditRepository } from './audit.repository';

describe('AuditRepository', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    auditLog: {
      count,
      findMany,
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  const repository = new AuditRepository(prisma as never);

  beforeEach(() => {
    count.mockReset();
    findMany.mockReset();
    prisma.$transaction.mockClear();

    count.mockResolvedValue(3);
    findMany.mockResolvedValue([]);
  });

  it('should apply event type, actor query, target id and inclusive date range filters', async () => {
    const dateFrom = new Date('2026-03-01T00:00:00.000Z');
    const dateTo = new Date('2026-03-31T23:59:59.999Z');

    await repository.listAuditEvents({
      page: 2,
      limit: 10,
      filters: {
        eventType: 'assessment.updated',
        actorQuery: 'seed-user-020@seed.local',
        actorUserId: '22222222-2222-4222-8222-222222222222',
        targetId: '11111111-1111-4111-8111-111111111111',
        assessmentId: '33333333-3333-4333-8333-333333333333',
        dateFrom,
        dateTo,
      },
      scope: { kind: 'admin' },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actionType: 'assessment.updated',
          assessmentId: '33333333-3333-4333-8333-333333333333',
          entityId: '11111111-1111-4111-8111-111111111111',
          userId: '22222222-2222-4222-8222-222222222222',
          timestamp: {
            gte: dateFrom,
            lte: dateTo,
          },
          user: {
            is: {
              OR: [
                {
                  fullName: {
                    contains: 'seed-user-020@seed.local',
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: 'seed-user-020@seed.local',
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('should limit notary queries to assessments assigned to the current notary', async () => {
    await repository.listAuditEvents({
      page: 1,
      limit: 20,
      filters: {},
      scope: {
        kind: 'notary',
        notaryId: 'notary-1',
      },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessment: {
            is: {
              notaryId: 'notary-1',
            },
          },
        },
      }),
    );
  });

  it('should export matching rows with optional cap and map details for the UI', async () => {
    findMany.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'user-1',
        actionType: 'assessment.created',
        entityName: 'Assessment',
        entityId: '11111111-1111-4111-8111-111111111111',
        timestamp: new Date('2026-03-06T08:45:00.000Z'),
        details: {
          actionTitle: 'Создана заявка',
          actionContext: 'Тестовый контекст',
          targetTitle: 'Заявка #11111111',
          targetContext: 'г. Екатеринбург, ул. Малышева, 18',
          ip: '10.0.0.1',
          userAgent: 'jest-agent',
          before: { status: 'draft' },
          after: { status: 'new' },
        },
        user: {
          id: 'user-1',
          fullName: 'Администратор 1',
          email: 'seed-user-020@seed.local',
          role: PrismaRole.Admin,
        },
        assessment: {
          id: '11111111-1111-4111-8111-111111111111',
          address: 'г. Екатеринбург, ул. Малышева, 18',
          notaryId: 'notary-1',
        },
      },
    ]);

    const response = await repository.exportAuditEvents({
      filters: {
        eventType: 'assessment.created',
      },
      scope: { kind: 'admin' },
      limit: 101,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actionType: 'assessment.created',
        },
        take: 101,
      }),
    );
    expect(findMany.mock.calls[0][0].skip).toBeUndefined();
    expect(response.events).toHaveLength(1);
    expect(response.events[0]).toEqual(
      expect.objectContaining({
        actionTitle: 'Создана заявка',
        actorRole: RpcUserRole.ADMIN,
        ip: '10.0.0.1',
        userAgent: 'jest-agent',
        beforeJson: JSON.stringify({ status: 'draft' }, null, 2),
        afterJson: JSON.stringify({ status: 'new' }, null, 2),
      }),
    );
  });
});

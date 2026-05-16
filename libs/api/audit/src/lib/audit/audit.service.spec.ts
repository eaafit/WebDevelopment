import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { Logger } from '@nestjs/common';
import {
  ExportAuditEventsRequestSchema,
  ListAuditEventsRequestSchema,
  ListAuditEventsResponseSchema,
  PaginationMetaSchema,
} from '@notary-portal/api-contracts';
import { Role, requestContextStorage, type AccessTokenPayload } from '@internal/auth-shared';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const auditRepository = {
    listAuditEvents: jest.fn(),
    exportAuditEvents: jest.fn(),
    countAuditEvents: jest.fn(),
    createAuditLog: jest.fn(),
  };

  const service = new AuditService(auditRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();

    auditRepository.listAuditEvents.mockResolvedValue(
      create(ListAuditEventsResponseSchema, {
        events: [],
        meta: create(PaginationMetaSchema, {
          totalItems: 0,
          totalPages: 1,
          currentPage: 1,
          perPage: 20,
        }),
      }),
    );
    auditRepository.countAuditEvents.mockResolvedValue(0);
    auditRepository.exportAuditEvents.mockResolvedValue({ events: [] });
    auditRepository.createAuditLog.mockResolvedValue(undefined);
  });

  it('should request an unrestricted feed for admins', async () => {
    await runAs(
      {
        sub: 'admin-1',
        email: 'seed-user-020@seed.local',
        role: Role.Admin,
        iat: 1,
        exp: 2,
      },
      () =>
        service.listAuditEvents(
          create(ListAuditEventsRequestSchema, {
            pagination: {
              page: 1,
              limit: 20,
            },
          }),
        ),
    );

    expect(auditRepository.listAuditEvents).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      filters: {
        actorQuery: undefined,
        actorUserId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        eventType: undefined,
        targetId: undefined,
      },
      scope: {
        kind: 'admin',
      },
    });
  });

  it('should restrict notaries to their own assessments and reuse the same scope for export', async () => {
    await runAs(
      {
        sub: 'notary-1',
        email: 'seed-user-010@seed.local',
        role: Role.Notary,
        iat: 1,
        exp: 2,
      },
      async () => {
        await service.listAuditEvents(
          create(ListAuditEventsRequestSchema, {
            pagination: {
              page: 1,
              limit: 20,
            },
            filters: {
              eventType: 'assessment.verified',
            },
          }),
        );
        await service.exportAuditEvents(
          create(ExportAuditEventsRequestSchema, {
            filters: {
              eventType: 'assessment.verified',
            },
          }),
        );
      },
    );

    expect(auditRepository.listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          kind: 'notary',
          notaryId: 'notary-1',
        },
      }),
    );
    expect(auditRepository.exportAuditEvents).toHaveBeenCalledWith({
      filters: {
        actorQuery: undefined,
        actorUserId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        eventType: 'assessment.verified',
        targetId: undefined,
      },
      scope: {
        kind: 'notary',
        notaryId: 'notary-1',
      },
      limit: 10001,
    });
  });

  it('should record entity id and request metadata in audit details', async () => {
    await runAs(
      {
        sub: 'notary-1',
        email: 'seed-user-010@seed.local',
        role: Role.Notary,
        iat: 1,
        exp: 2,
      },
      () =>
        service.record({
          eventType: 'assessment.updated',
          targetType: 'Assessment',
          targetId: '11111111-1111-4111-8111-111111111111',
          actionTitle: 'Обновлена заявка',
          actionContext: 'Изменён адрес',
          targetTitle: 'Заявка #11111111',
          targetContext: 'г. Екатеринбург, ул. Малышева, 18',
          before: { address: 'Старый адрес' },
          after: { address: 'Новый адрес' },
        }),
      {
        ip: '10.0.0.5',
        userAgent: 'jest-agent',
      },
    );

    expect(auditRepository.createAuditLog).toHaveBeenCalledWith({
      userId: 'notary-1',
      actionType: 'assessment.updated',
      entityName: 'Assessment',
      entityId: '11111111-1111-4111-8111-111111111111',
      details: {
        actionTitle: 'Обновлена заявка',
        actionContext: 'Изменён адрес',
        targetTitle: 'Заявка #11111111',
        targetContext: 'г. Екатеринбург, ул. Малышева, 18',
        before: { address: 'Старый адрес' },
        after: { address: 'Новый адрес' },
        ip: '10.0.0.5',
        userAgent: 'jest-agent',
      },
      timestamp: undefined,
    });
  });

  it('should normalize exact actor and target filters', async () => {
    await runAs(
      {
        sub: 'admin-1',
        email: 'seed-user-020@seed.local',
        role: Role.Admin,
        iat: 1,
        exp: 2,
      },
      () =>
        service.listAuditEvents(
          create(ListAuditEventsRequestSchema, {
            pagination: {
              page: 1,
              limit: 100,
            },
            filters: {
              actorUserId: '11111111-1111-4111-8111-111111111111',
              targetId: '22222222-2222-4222-8222-222222222222',
            },
          }),
        ),
    );

    expect(auditRepository.listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
        filters: expect.objectContaining({
          actorUserId: '11111111-1111-4111-8111-111111111111',
          targetId: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    );
  });

  it('should reject page limits above the service cap', async () => {
    await expect(
      Promise.resolve().then(() =>
        runAs(
          {
            sub: 'admin-1',
            email: 'seed-user-020@seed.local',
            role: Role.Admin,
            iat: 1,
            exp: 2,
          },
          () =>
            service.listAuditEvents(
              create(ListAuditEventsRequestSchema, {
                pagination: {
                  page: 1,
                  limit: 101,
                },
              }),
            ),
        ),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ConnectError>>({
        code: Code.InvalidArgument,
      }),
    );
  });

  it('should reject exports above the row cap without truncating', async () => {
    auditRepository.countAuditEvents.mockResolvedValue(10001);

    await expect(
      runAs(
        {
          sub: 'admin-1',
          email: 'seed-user-020@seed.local',
          role: Role.Admin,
          iat: 1,
          exp: 2,
        },
        () => service.exportAuditEvents(create(ExportAuditEventsRequestSchema, {})),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ConnectError>>({
        code: Code.ResourceExhausted,
      }),
    );
    expect(auditRepository.exportAuditEvents).not.toHaveBeenCalled();
    expect(auditRepository.createAuditLog).not.toHaveBeenCalled();
  });

  it('should reject export when rows exceed the cap after count guard', async () => {
    auditRepository.countAuditEvents.mockResolvedValue(10000);
    auditRepository.exportAuditEvents.mockResolvedValue({
      events: Array.from({ length: 10001 }, (_, index) => ({ id: `audit-${index}` })),
    });

    await expect(
      runAs(
        {
          sub: 'admin-1',
          email: 'seed-user-020@seed.local',
          role: Role.Admin,
          iat: 1,
          exp: 2,
        },
        () => service.exportAuditEvents(create(ExportAuditEventsRequestSchema, {})),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ConnectError>>({
        code: Code.ResourceExhausted,
      }),
    );
    expect(auditRepository.exportAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10001,
      }),
    );
    expect(auditRepository.createAuditLog).not.toHaveBeenCalled();
  });

  it('should record audit export after successful export', async () => {
    auditRepository.countAuditEvents.mockResolvedValue(1);
    auditRepository.exportAuditEvents.mockResolvedValue({ events: [{ id: 'audit-1' }] });

    await runAs(
      {
        sub: '33333333-3333-4333-8333-333333333333',
        email: 'admin@example.local',
        role: Role.Admin,
        iat: 1,
        exp: 2,
      },
      () =>
        service.exportAuditEvents(
          create(ExportAuditEventsRequestSchema, {
            filters: {
              eventType: 'assessment.created',
              actorUserId: '11111111-1111-4111-8111-111111111111',
              targetId: '22222222-2222-4222-8222-222222222222',
            },
          }),
        ),
      {
        ip: '10.0.0.6',
        userAgent: 'export-agent',
      },
    );

    expect(auditRepository.exportAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10001,
      }),
    );
    expect(auditRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '33333333-3333-4333-8333-333333333333',
        actionType: 'audit.exported',
        entityName: 'Assessment',
        entityId: '22222222-2222-4222-8222-222222222222',
        details: expect.objectContaining({
          after: {
            filters: expect.objectContaining({
              eventType: 'assessment.created',
              actorUserId: '11111111-1111-4111-8111-111111111111',
              targetId: '22222222-2222-4222-8222-222222222222',
            }),
            exportedRows: 1,
          },
          ip: '10.0.0.6',
          userAgent: 'export-agent',
        }),
      }),
    );
  });

  it('should not throw from record when audit persistence fails', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    auditRepository.createAuditLog.mockRejectedValue(new Error('db is unavailable'));

    await expect(
      runAs(
        {
          sub: 'notary-1',
          email: 'seed-user-010@seed.local',
          role: Role.Notary,
          iat: 1,
          exp: 2,
        },
        () =>
          service.record({
            eventType: 'assessment.updated',
            targetType: 'Assessment',
            targetId: '11111111-1111-4111-8111-111111111111',
            actionTitle: 'Обновлена заявка',
          }),
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to record audit event assessment.updated'),
    );
    warnSpy.mockRestore();
  });
});

function runAs<T>(
  user: AccessTokenPayload,
  callback: () => Promise<T>,
  metadata: { ip: string | null; userAgent: string | null } = {
    ip: null,
    userAgent: null,
  },
): Promise<T> {
  return requestContextStorage.run({ user, metadata }, callback);
}

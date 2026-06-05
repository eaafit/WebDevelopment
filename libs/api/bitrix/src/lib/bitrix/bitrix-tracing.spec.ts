import { create } from '@bufbuild/protobuf';
import { Logger } from '@nestjs/common';
import type { Span } from '@opentelemetry/api';
import { requestContextStorage } from '@internal/auth-shared';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  runInSpan,
} from '@internal/tracing';
import { UpdateBitrixConfigRequestSchema } from '@notary-portal/api-contracts';
import { BitrixApiService } from './bitrix-api.service';
import { BitrixRpcService } from './bitrix-rpc.service';
import { BitrixSyncService } from './bitrix-sync.service';

jest.mock('@internal/tracing', () => {
  const actual = jest.requireActual<typeof import('@internal/tracing')>('@internal/tracing');
  return {
    ...actual,
    markSpanFailure: jest.fn(),
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

describe('Bitrix handled failure tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks handled connection and contact lookup failures without unsafe logs', async () => {
    const configService = {
      getActiveConfig: jest.fn().mockResolvedValue({
        portalUrl: 'portal.example.test',
        memberId: 'member',
        accessToken: 'secret-token',
      }),
    };
    const service = new BitrixApiService(configService as never);
    const rawError = new Error('failed for user@example.com token=secret-token');
    const post = jest.fn().mockRejectedValue(rawError);
    Object.assign(service as object, { axiosInstance: { post } });
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(service.testConnection()).resolves.toMatchObject({ success: false });
    await expect(service.findContactByEmail('user@example.com')).resolves.toBeNull();

    expect(markSpanFailure).toHaveBeenCalledWith(expect.anything(), rawError);
    const logged = JSON.stringify(loggerSpy.mock.calls);
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('secret-token');
    loggerSpy.mockRestore();
  });

  it('marks a handled background sync failure while preserving failed job persistence', async () => {
    const rawError = new Error('database failed for user@example.com token=secret-token');
    const prisma = {
      bitrixSync: {
        create: jest.fn().mockRejectedValue(rawError),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new BitrixSyncService(prisma as never, {} as never, {} as never);
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await (
      service as unknown as {
        runSyncInBackground(jobId: string, forceResync: boolean): Promise<void>;
      }
    ).runSyncInBackground('job-1', false);

    expect(markSpanFailure).toHaveBeenCalledWith(expect.anything(), rawError);
    expect(prisma.bitrixSync.updateMany).toHaveBeenCalledWith({
      where: { jobId: 'job-1', status: 'running' },
      data: {
        status: 'failed',
        errorMessage: rawError.message,
        completedAt: expect.any(Date),
      },
    });
    const logged = JSON.stringify(loggerSpy.mock.calls);
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('secret-token');
    loggerSpy.mockRestore();
  });

  it('uses one aggregate background span helper invocation', async () => {
    const prisma = {
      bitrixSync: {
        create: jest.fn().mockRejectedValue(new Error('failed')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new BitrixSyncService(prisma as never, {} as never, {} as never);

    await (
      service as unknown as {
        runSyncInBackground(jobId: string, forceResync: boolean): Promise<void>;
      }
    ).runSyncInBackground('job-1', false);

    expect(runInSpan).toHaveBeenCalledTimes(1);
  });

  it('records the authenticated actor role only after admin authorization succeeds', async () => {
    const configService = {
      updateConfig: jest.fn().mockResolvedValue({ isActive: true }),
    };
    const service = new BitrixRpcService(configService as never, {} as never, {} as never);

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
        service.updateBitrixConfig(
          create(UpdateBitrixConfigRequestSchema, {
            portalUrl: 'portal.example.test',
            memberId: 'member',
            accessToken: 'secret-token',
            isActive: true,
          }),
        ),
    );

    expect(runInSpan).toHaveBeenCalledWith(
      'BitrixRpcService.updateBitrixConfig',
      expect.objectContaining({
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixConfigUpdate,
        [NotarySpanAttributes.actorRole]: 'admin',
      }),
      expect.any(Function),
    );
  });
});

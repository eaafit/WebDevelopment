import { trace } from '@opentelemetry/api';
import { BusinessOperations, NotarySpanAttributes } from '@internal/tracing';
import { BitrixLeadPublisherService } from './bitrix-lead-publisher.service';
import {
  BitrixAuthError,
  BitrixRateLimitError,
  BitrixUnavailableError,
  BitrixValidationError,
} from './bitrix-leads.errors';

type PrismaMock = {
  assessment: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
};
type ApiMock = { createLead: jest.Mock };
type ConfigMock = { isConfigured: jest.Mock };

function makeMocks(overrides: { configured?: boolean } = {}): {
  prisma: PrismaMock;
  api: ApiMock;
  config: ConfigMock;
  service: BitrixLeadPublisherService;
} {
  const prisma: PrismaMock = {
    assessment: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const api: ApiMock = { createLead: jest.fn() };
  const config: ConfigMock = {
    isConfigured: jest.fn().mockReturnValue(overrides.configured ?? true),
  };
  const service = new BitrixLeadPublisherService(prisma as never, api as never, config as never);
  return { prisma, api, config, service };
}

const sampleAssessment = {
  id: 'a-1',
  userId: 'u-1',
  address: 'Москва, Тверская, 1',
  description: 'Тест',
  estimatedValue: '1000000',
  bitrixLeadId: null,
};

const sampleUser = {
  id: 'u-1',
  fullName: 'Иванов Иван',
  email: 'i@i.ru',
  phoneNumber: '+79991234567',
};

describe('BitrixLeadPublisherService', () => {
  describe('when Bitrix is not configured', () => {
    it('skips publication without touching prisma or api', async () => {
      const { prisma, api, service } = makeMocks({ configured: false });

      await expect(service.publishLead('a-1')).resolves.toBeUndefined();

      expect(prisma.assessment.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(api.createLead).not.toHaveBeenCalled();
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('looks up assessment + user, calls api.createLead, persists bitrixLeadId', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockResolvedValue(12345);

      await service.publishLead('a-1');

      expect(prisma.assessment.findUnique).toHaveBeenCalledWith({ where: { id: 'a-1' } });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-1' } });
      expect(api.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          UF_CRM_ASSESSMENT_ID: 'a-1',
          TITLE: expect.stringContaining('Заявка'),
        }),
      );
      expect(prisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'a-1' },
        data: { bitrixLeadId: '12345' },
      });
    });

    it('traces root and child operations without PII or full ids in attributes', async () => {
      const tracing = mockTracer();
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockResolvedValue(12345);

      await service.publishLead('a-1');

      expect(spanAttributes(tracing, 'BitrixLeadPublisherService.publishLead')).toMatchObject({
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadPublish,
        [NotarySpanAttributes.entity]: 'BitrixLead',
      });
      expect(
        spanAttributes(tracing, 'Prisma.assessment.findUnique bitrix lead publish'),
      ).toMatchObject({
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadAssessmentLookup,
        [NotarySpanAttributes.entity]: 'Assessment',
        'db.operation': 'select',
      });
      expect(spanAttributes(tracing, 'Prisma.user.findUnique bitrix lead publish')).toMatchObject({
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadUserLookup,
        [NotarySpanAttributes.entity]: 'User',
        'db.operation': 'select',
      });
      expect(spanAttributes(tracing, 'Prisma.assessment.update bitrix lead id')).toMatchObject({
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadPersistExternalId,
        [NotarySpanAttributes.entity]: 'Assessment',
        'db.operation': 'update',
      });
      const serializedSpanData = JSON.stringify({
        startSpanCalls: tracing.startSpan.mock.calls,
        setAttributeCalls: [...tracing.spans.values()].map((span) => span.setAttribute.mock.calls),
      });
      expect(serializedSpanData).not.toContain(sampleAssessment.address);
      expect(serializedSpanData).not.toContain(sampleUser.email);
      expect(serializedSpanData).not.toContain(sampleUser.phoneNumber);
      expect(serializedSpanData).not.toContain('a-1');
      expect(serializedSpanData).not.toContain('u-1');

      tracing.restore();
    });

    it('converts numeric leadId to string for VARCHAR storage', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockResolvedValue(99999);

      await service.publishLead('a-1');

      expect(prisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bitrixLeadId: '99999' } }),
      );
    });
  });

  describe('not-found scenarios', () => {
    it('throws when assessment is missing', async () => {
      const { prisma, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(null);

      await expect(service.publishLead('missing')).rejects.toThrow(/Assessment missing not found/);
    });

    it('throws when user is missing', async () => {
      const { prisma, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.publishLead('a-1')).rejects.toThrow(/User u-1 not found/);
    });
  });

  describe('idempotency', () => {
    it('skips when assessment already has bitrixLeadId', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue({
        ...sampleAssessment,
        bitrixLeadId: '5821',
      });

      await service.publishLead('a-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(api.createLead).not.toHaveBeenCalled();
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });
  });

  describe('Bitrix non-retriable errors', () => {
    it('propagates BitrixAuthError on first attempt without retry', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockRejectedValue(new BitrixAuthError('Bad token'));

      await expect(service.publishLead('a-1')).rejects.toBeInstanceOf(BitrixAuthError);
      expect(api.createLead).toHaveBeenCalledTimes(1);
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });

    it('propagates BitrixValidationError on first attempt without retry', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockRejectedValue(new BitrixValidationError('bad phone'));

      await expect(service.publishLead('a-1')).rejects.toBeInstanceOf(BitrixValidationError);
      expect(api.createLead).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bitrix retriable errors', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('retries BitrixUnavailableError and succeeds on 2nd attempt', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead
        .mockRejectedValueOnce(new BitrixUnavailableError('temp'))
        .mockResolvedValueOnce(777);

      const promise = service.publishLead('a-1');
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(api.createLead).toHaveBeenCalledTimes(2);
      expect(prisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bitrixLeadId: '777' } }),
      );
    });

    it('retries BitrixRateLimitError and succeeds on 3rd attempt', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead
        .mockRejectedValueOnce(new BitrixRateLimitError('slow down'))
        .mockRejectedValueOnce(new BitrixRateLimitError('slow down'))
        .mockResolvedValueOnce(888);

      const promise = service.publishLead('a-1');
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(api.createLead).toHaveBeenCalledTimes(3);
    });

    it('gives up after maxAttempts of BitrixUnavailableError without updating db', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockRejectedValue(new BitrixUnavailableError('5xx'));

      const promise = service.publishLead('a-1');
      promise.catch(() => undefined); // suppress unhandled while we advance timers
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(3000);

      await expect(promise).rejects.toBeInstanceOf(BitrixUnavailableError);
      expect(api.createLead).toHaveBeenCalledTimes(3);
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });

    it('does NOT retry BitrixAuthError even when wrapped in retryWithBackoff', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.assessment.findUnique.mockResolvedValue(sampleAssessment);
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      api.createLead.mockRejectedValue(new BitrixAuthError('Bad token'));

      await expect(service.publishLead('a-1')).rejects.toBeInstanceOf(BitrixAuthError);
      expect(api.createLead).toHaveBeenCalledTimes(1);
    });
  });
});

type TracedSpanMock = {
  end: jest.Mock;
  recordException: jest.Mock;
  setAttribute: jest.Mock;
  setStatus: jest.Mock;
};

function mockTracer(): {
  spans: Map<string, TracedSpanMock>;
  startSpan: jest.Mock;
  restore: () => void;
} {
  const spans = new Map<string, TracedSpanMock>();
  const startSpan = jest.fn((spanName: string) => {
    const span = {
      end: jest.fn(),
      recordException: jest.fn(),
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
    };
    spans.set(spanName, span);
    return span;
  });
  const getTracerSpy = jest.spyOn(trace, 'getTracer').mockReturnValue({ startSpan } as never);

  return {
    spans,
    startSpan,
    restore: () => getTracerSpy.mockRestore(),
  };
}

function spanAttributes(
  tracing: { startSpan: jest.Mock },
  spanName: string,
): Record<string, unknown> | undefined {
  const call = tracing.startSpan.mock.calls.find(([name]) => name === spanName);
  return call?.[1]?.attributes;
}

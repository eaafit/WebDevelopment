import { BitrixOrderPublisherService } from './bitrix-order-publisher.service';
import {
  BitrixAuthError,
  BitrixRateLimitError,
  BitrixUnavailableError,
  BitrixValidationError,
} from './bitrix-orders.errors';

type PrismaMock = {
  lead: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};
type ApiMock = { createOrder: jest.Mock };
type ConfigMock = { isConfigured: jest.Mock };

function makeMocks(overrides: { configured?: boolean } = {}): {
  prisma: PrismaMock;
  api: ApiMock;
  config: ConfigMock;
  service: BitrixOrderPublisherService;
} {
  const prisma: PrismaMock = {
    lead: { findUnique: jest.fn(), update: jest.fn() },
  };
  const api: ApiMock = { createOrder: jest.fn() };
  const config: ConfigMock = {
    isConfigured: jest.fn().mockReturnValue(overrides.configured ?? true),
  };
  const service = new BitrixOrderPublisherService(
    prisma as never,
    api as never,
    config as never,
  );
  return { prisma, api, config, service };
}

const sampleLead = {
  id: 'order-1',
  assessmentId: 'ass-1',
  applicantId: 'user-1',
  bitrixOrderId: null,
  assessment: {
    id: 'ass-1',
    address: 'Москва, Тверская, 1',
    description: 'Тестовый заказ',
    estimatedValue: { toString: () => '1000000' },
  },
  applicant: {
    id: 'user-1',
    fullName: 'Иванов Иван',
    email: 'ivan@example.com',
    phoneNumber: '+79991234567',
  },
};

describe('BitrixOrderPublisherService', () => {
  describe('when Bitrix is not configured', () => {
    it('skips publication without touching prisma or api', async () => {
      const { prisma, api, service } = makeMocks({ configured: false });

      await expect(service.publishOrder('order-1')).resolves.toBeUndefined();

      expect(prisma.lead.findUnique).not.toHaveBeenCalled();
      expect(api.createOrder).not.toHaveBeenCalled();
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('looks up lead + assessment + applicant, calls api.createOrder, persists bitrixOrderId', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockResolvedValue(12345);

      await service.publishOrder('order-1');

      expect(prisma.lead.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { assessment: true, applicant: true },
      });
      expect(api.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          BASKET: expect.arrayContaining([
            expect.objectContaining({
              NAME: expect.stringContaining('Оценка недвижимости'),
              PRICE: 1000000,
            }),
          ]),
        }),
      );
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { bitrixOrderId: '12345' },
      });
    });

    it('converts numeric orderId to string for VARCHAR storage', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockResolvedValue(99999);

      await service.publishOrder('order-1');

      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bitrixOrderId: '99999' } }),
      );
    });
  });

  describe('not-found scenarios', () => {
    it('throws when lead is missing', async () => {
      const { prisma, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.publishOrder('missing')).rejects.toThrow(/Order missing not found/);
    });
  });

  describe('idempotency', () => {
    it('skips when lead already has bitrixOrderId', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue({
        ...sampleLead,
        bitrixOrderId: '5821',
      });

      await service.publishOrder('order-1');

      expect(api.createOrder).not.toHaveBeenCalled();
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('Bitrix non-retriable errors', () => {
    it('propagates BitrixAuthError on first attempt without retry', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockRejectedValue(new BitrixAuthError('Bad token'));

      await expect(service.publishOrder('order-1')).rejects.toBeInstanceOf(BitrixAuthError);
      expect(api.createOrder).toHaveBeenCalledTimes(1);
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it('propagates BitrixValidationError on first attempt without retry', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockRejectedValue(new BitrixValidationError('bad basket'));

      await expect(service.publishOrder('order-1')).rejects.toBeInstanceOf(BitrixValidationError);
      expect(api.createOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bitrix retriable errors', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('retries BitrixUnavailableError and succeeds on 2nd attempt', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder
        .mockRejectedValueOnce(new BitrixUnavailableError('temp'))
        .mockResolvedValueOnce(777);

      const promise = service.publishOrder('order-1');
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(api.createOrder).toHaveBeenCalledTimes(2);
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bitrixOrderId: '777' } }),
      );
    });

    it('retries BitrixRateLimitError and succeeds on 3rd attempt', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder
        .mockRejectedValueOnce(new BitrixRateLimitError('slow down'))
        .mockRejectedValueOnce(new BitrixRateLimitError('slow down'))
        .mockResolvedValueOnce(888);

      const promise = service.publishOrder('order-1');
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(api.createOrder).toHaveBeenCalledTimes(3);
    });

    it('gives up after maxAttempts of BitrixUnavailableError without updating db', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockRejectedValue(new BitrixUnavailableError('5xx'));

      const promise = service.publishOrder('order-1');
      promise.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(3000);

      await expect(promise).rejects.toBeInstanceOf(BitrixUnavailableError);
      expect(api.createOrder).toHaveBeenCalledTimes(3);
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it('does NOT retry BitrixAuthError even when wrapped in retryWithBackoff', async () => {
      const { prisma, api, service } = makeMocks();
      prisma.lead.findUnique.mockResolvedValue(sampleLead);
      api.createOrder.mockRejectedValue(new BitrixAuthError('Bad token'));

      await expect(service.publishOrder('order-1')).rejects.toBeInstanceOf(BitrixAuthError);
      expect(api.createOrder).toHaveBeenCalledTimes(1);
    });
  });
});
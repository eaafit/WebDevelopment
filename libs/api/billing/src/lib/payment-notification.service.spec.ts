import { Role as PrismaRole, PaymentStatus, PaymentType } from '@internal/prisma-client';
import { Logger } from '@nestjs/common';
import { PaymentNotificationService } from './payment-notification.service';

describe('PaymentNotificationService', () => {
  const findMany = jest.fn();
  const notificationService = {
    createInternalNotification: jest.fn(),
  };
  const prisma = {
    user: {
      findMany,
    },
  };

  let service: PaymentNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    notificationService.createInternalNotification.mockResolvedValue(undefined);
    service = new PaymentNotificationService(prisma as never, notificationService as never);
  });

  it('should notify payer and active admins about completed subscription payments', async () => {
    await service.notifyPaymentCompleted({
      id: 'payment-12345678',
      userId: 'notary-1',
      type: PaymentType.Subscription,
      amount: '1350.00',
      status: PaymentStatus.Completed,
      subscriptionId: 'subscription-12345678',
      paymentMethod: 'bank_card',
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        role: PrismaRole.Admin,
        isActive: true,
        id: { notIn: ['notary-1'] },
      },
      select: { id: true },
    });
    expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'notary-1',
        message: expect.stringContaining('успешно оплачен'),
      }),
    );
    expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        message: expect.stringContaining('Платёж оплачен'),
      }),
    );
    expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-2',
        message: expect.stringContaining('оплата подписки'),
      }),
    );
  });

  it('should deduplicate admin recipients and keep fanout best effort', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'admin-1' },
      { id: 'notary-1' },
      { id: 'admin-2' },
    ]);
    notificationService.createInternalNotification.mockImplementation(
      ({ userId }: { userId: string }) =>
        userId === 'admin-2' ? Promise.reject(new Error('delivery failed')) : Promise.resolve(),
    );

    await expect(
      service.notifyPaymentUpdated({
        id: 'payment-12345678',
        userId: 'notary-1',
        type: PaymentType.Subscription,
        amount: '1350.00',
        status: PaymentStatus.Pending,
      }),
    ).resolves.toBeUndefined();

    expect(
      notificationService.createInternalNotification.mock.calls.filter(
        ([payload]) => payload.userId === 'notary-1',
      ),
    ).toHaveLength(1);
    expect(
      notificationService.createInternalNotification.mock.calls.filter(
        ([payload]) => payload.userId === 'admin-1',
      ),
    ).toHaveLength(1);
    expect(
      notificationService.createInternalNotification.mock.calls.filter(
        ([payload]) => payload.userId === 'admin-2',
      ),
    ).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith('Failed to create 1 admin payment notification(s)');

    warnSpy.mockRestore();
  });

  it('should send provider issue notifications to admins only', async () => {
    await service.notifyPaymentProviderIssue(
      {
        id: 'payment-12345678',
        userId: 'notary-1',
        type: PaymentType.Subscription,
        amount: '1350.00',
        status: PaymentStatus.Pending,
        paymentMethod: 'robokassa_redirect',
      },
      'Robokassa',
      'signature is invalid',
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        role: PrismaRole.Admin,
        isActive: true,
        id: { notIn: ['notary-1'] },
      },
      select: { id: true },
    });
    expect(notificationService.createInternalNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'notary-1',
      }),
    );
    expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        title: expect.stringContaining('Robokassa'),
        message: expect.stringContaining('signature is invalid'),
      }),
    );
    expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-2',
        message: expect.stringContaining('robokassa_redirect'),
      }),
    );
  });
});

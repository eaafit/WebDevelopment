import { Role as PrismaRole, PaymentStatus, PaymentType } from '@internal/prisma-client';
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
});

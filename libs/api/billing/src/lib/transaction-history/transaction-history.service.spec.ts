import { create } from '@bufbuild/protobuf';
import {
  ConnectError,
  Code,
} from '@connectrpc/connect';
import {
  GetPaymentHistoryRequestSchema,
  GetPaymentHistoryResponseSchema,
  PaymentStatus,
  PaymentType,
  type UpdatePaymentRequest,
  type DeletePaymentRequest,
  type Payment,
} from '@notary-portal/api-contracts';
import { TransactionHistoryService } from './transaction-history.service';

jest.mock('@internal/auth-shared', () => ({
  getCurrentUser: jest.fn(),
}));

import { getCurrentUser } from '@internal/auth-shared';

describe('TransactionHistoryService', () => {
  const transactionHistoryRepository = {
    getTransactionHistory: jest.fn(),
    getPaymentAuditSnapshot: jest.fn(),
    updatePayment: jest.fn(),
    deletePayment: jest.fn(),
  };
  const metrics = {
    recordPaymentHistoryRequest: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const notificationService = {
    createInternalNotification: jest.fn(),
  };

  let service: TransactionHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionHistoryService(
      transactionHistoryRepository as never,
      metrics as never,
      auditService as never,
      notificationService as never,
    );
  });

  describe('getPaymentHistory', () => {
    it('should delegate to the transaction history repository', async () => {
      const response = create(GetPaymentHistoryResponseSchema, {
        payments: [],
        meta: {
          totalItems: 0,
          totalPages: 1,
          currentPage: 1,
          perPage: 10,
        },
      });
      transactionHistoryRepository.getTransactionHistory.mockResolvedValue(response);

      const request = create(GetPaymentHistoryRequestSchema, {
        pagination: {
          page: 1,
          limit: 10,
        },
      });

      await expect(service.getPaymentHistory(request)).resolves.toEqual(response);
      expect(transactionHistoryRepository.getTransactionHistory).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
      expect(metrics.recordPaymentHistoryRequest).toHaveBeenCalledWith('all', 'success');
    });
  });

  describe('updatePayment', () => {
    it('should delegate to repository with valid request', async () => {
      const updateResponse = { payment: { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' } };
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(null);
      transactionHistoryRepository.updatePayment.mockResolvedValue(updateResponse);

      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        amount: '100.50',
        status: PaymentStatus.COMPLETED,
      } as UpdatePaymentRequest;

      await expect(service.updatePayment(request)).resolves.toEqual(updateResponse);
      expect(transactionHistoryRepository.updatePayment).toHaveBeenCalledWith(request);
    });

    it('should throw INVALID_ARGUMENT for non-UUID id', async () => {
      const request = { id: 'not-a-uuid' } as UpdatePaymentRequest;

      await expect(service.updatePayment(request)).rejects.toThrow(ConnectError);
      try {
        await service.updatePayment(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectError);
        expect((error as ConnectError).code).toBe(Code.InvalidArgument);
      }
    });

    it('should throw INVALID_ARGUMENT for UNSPECIFIED status', async () => {
      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        status: PaymentStatus.UNSPECIFIED,
      } as UpdatePaymentRequest;

      await expect(service.updatePayment(request)).rejects.toThrow(ConnectError);
      try {
        await service.updatePayment(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectError);
        expect((error as ConnectError).code).toBe(Code.InvalidArgument);
      }
    });

    it('should throw INVALID_ARGUMENT for invalid amount format', async () => {
      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        amount: 'abc',
      } as UpdatePaymentRequest;

      await expect(service.updatePayment(request)).rejects.toThrow(ConnectError);
      try {
        await service.updatePayment(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectError);
        expect((error as ConnectError).code).toBe(Code.InvalidArgument);
      }
    });

    it('should record audit and send notification on successful update', async () => {
      const paymentId = 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890';
      const userId = 'b2c3d4e5-f6a7-4bcd-abcd-ef1234567890';
      const assessmentId = 'c3d4e5f6-a7b8-4bcd-abcd-ef1234567890';

      const beforeSnapshot = {
        id: paymentId,
        userId,
        status: 'Pending',
        amount: '50.00',
        type: 'Assessment',
        paymentMethod: 'card',
        transactionId: null,
        assessmentId,
        subscriptionId: null,
      };
      const updatedPayment = {
        id: paymentId,
        userId,
        status: PaymentStatus.COMPLETED,
        amount: { amount: '100.50' },
        type: PaymentType.ASSESSMENT,
        paymentMethod: 'card',
        transactionId: 'tx-123',
        assessmentId,
        subscriptionId: null,
      } as unknown as Payment;

      (getCurrentUser as jest.Mock).mockReturnValue({ sub: 'admin-user-id' });
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(beforeSnapshot);
      transactionHistoryRepository.updatePayment.mockResolvedValue({ payment: updatedPayment });

      const request = {
        id: paymentId,
        status: PaymentStatus.COMPLETED,
        amount: '100.50',
      } as UpdatePaymentRequest;

      await service.updatePayment(request);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-user-id',
          eventType: 'payment.updated',
          actionTitle: 'Платёж обновлён',
          before: expect.objectContaining({ paymentId, status: 'Pending', amount: '50.00' }),
          after: expect.objectContaining({ paymentId, status: 'Completed', amount: '100.50' }),
        }),
      );
      expect(notificationService.createInternalNotification).toHaveBeenCalledWith({
        userId,
        message: `Платёж #a1b2c3d4 обновлён`,
      });
    });

    it('should not record audit when update returns no payment', async () => {
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(null);
      transactionHistoryRepository.updatePayment.mockResolvedValue({ payment: undefined });

      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        status: PaymentStatus.COMPLETED,
      } as UpdatePaymentRequest;

      await service.updatePayment(request);

      expect(auditService.record).not.toHaveBeenCalled();
      expect(notificationService.createInternalNotification).not.toHaveBeenCalled();
    });
  });

  describe('deletePayment', () => {
    it('should delegate to repository with valid id', async () => {
      const deleteResponse = { success: true };
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(null);
      transactionHistoryRepository.deletePayment.mockResolvedValue(deleteResponse);

      const request = { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' } as DeletePaymentRequest;

      await expect(service.deletePayment(request)).resolves.toEqual(deleteResponse);
      expect(transactionHistoryRepository.deletePayment).toHaveBeenCalledWith(request);
    });

    it('should throw INVALID_ARGUMENT for non-UUID id', async () => {
      const request = { id: 'invalid' } as DeletePaymentRequest;

      await expect(service.deletePayment(request)).rejects.toThrow(ConnectError);
      try {
        await service.deletePayment(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectError);
        expect((error as ConnectError).code).toBe(Code.InvalidArgument);
      }
    });

    it('should record audit and send notification on successful delete', async () => {
      const paymentId = 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890';
      const userId = 'b2c3d4e5-f6a7-4bcd-abcd-ef1234567890';
      const assessmentId = 'c3d4e5f6-a7b8-4bcd-abcd-ef1234567890';

      const beforeSnapshot = {
        id: paymentId,
        userId,
        status: 'Pending',
        amount: '100.50',
        type: 'Assessment',
        paymentMethod: 'card',
        transactionId: null,
        assessmentId,
        subscriptionId: null,
      };

      (getCurrentUser as jest.Mock).mockReturnValue({ sub: 'admin-user-id' });
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(beforeSnapshot);
      transactionHistoryRepository.deletePayment.mockResolvedValue({ success: true });

      const request = { id: paymentId } as DeletePaymentRequest;

      await service.deletePayment(request);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-user-id',
          eventType: 'payment.deleted',
          actionTitle: 'Платёж удалён',
          before: expect.objectContaining({ paymentId, status: 'Pending', amount: '100.50' }),
        }),
      );
      expect(notificationService.createInternalNotification).toHaveBeenCalledWith({
        userId,
        message: `Платёж #a1b2c3d4 удалён`,
      });
    });

    it('should not record audit when snapshot is null', async () => {
      transactionHistoryRepository.getPaymentAuditSnapshot.mockResolvedValue(null);
      transactionHistoryRepository.deletePayment.mockResolvedValue({ success: true });

      const request = { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' } as DeletePaymentRequest;

      await service.deletePayment(request);

      expect(auditService.record).not.toHaveBeenCalled();
      expect(notificationService.createInternalNotification).not.toHaveBeenCalled();
    });
  });
});

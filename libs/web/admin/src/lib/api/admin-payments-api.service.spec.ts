import { TestBed } from '@angular/core/testing';
import { PaymentStatus as RpcPaymentStatus, PaymentType as RpcPaymentType } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, WebLoggerService } from '@notary-portal/ui';
import { createClient } from '@connectrpc/connect';
import { firstValueFrom } from 'rxjs';
import { AdminPaymentsApiService } from './admin-payments-api.service';

jest.mock('@connectrpc/connect', () => {
  const actual = jest.requireActual('@connectrpc/connect');
  return {
    ...actual,
    createClient: jest.fn(),
  };
});

const mockCreateClient = createClient as jest.Mock;

describe('AdminPaymentsApiService', () => {
  let service: AdminPaymentsApiService;
  let client: {
    getPaymentHistory: jest.Mock;
    createPayment: jest.Mock;
    updatePayment: jest.Mock;
    deletePayment: jest.Mock;
  };
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    client = {
      getPaymentHistory: jest.fn(),
      createPayment: jest.fn(),
      updatePayment: jest.fn(),
      deletePayment: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockCreateClient.mockReturnValue(client);

    TestBed.configureTestingModule({
      providers: [
        AdminPaymentsApiService,
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: WebLoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(AdminPaymentsApiService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
  });

  it('fetches all pages and maps RPC payments for admin UI', async () => {
    client.getPaymentHistory
      .mockResolvedValueOnce({
        payments: [
          rpcPayment({
            id: 'payment-1',
            amount: '12500.50',
            status: RpcPaymentStatus.COMPLETED,
            type: RpcPaymentType.ASSESSMENT,
            assessmentId: 'assessment-1',
            paymentMethod: 'card',
          }),
        ],
        meta: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        payments: [
          rpcPayment({
            id: 'payment-2',
            amount: '790',
            status: RpcPaymentStatus.REFUNDED,
            type: RpcPaymentType.SUBSCRIPTION,
            subscriptionId: 'subscription-1',
            paymentMethod: 'unknown-method',
          }),
        ],
        meta: { totalPages: 2 },
      });

    const payments = await service.getAllPayments();

    expect(client.getPaymentHistory).toHaveBeenCalledTimes(2);
    expect(client.getPaymentHistory).toHaveBeenNthCalledWith(1, {
      pagination: { page: 1, limit: 500 },
      filters: {
        searchQuery: '',
        statuses: [],
        types: [],
        paymentDateRange: undefined,
      },
    });
    expect(client.getPaymentHistory).toHaveBeenNthCalledWith(2, {
      pagination: { page: 2, limit: 500 },
      filters: {
        searchQuery: '',
        statuses: [],
        types: [],
        paymentDateRange: undefined,
      },
    });
    expect(payments).toEqual([
      expect.objectContaining({
        id: 'payment-1',
        amount: 12500.5,
        status: 'completed',
        statusText: 'Завершен',
        type: 'Assessment',
        assessmentId: 'assessment-1',
        paymentMethod: 'card',
      }),
      expect.objectContaining({
        id: 'payment-2',
        amount: 790,
        status: 'refunded',
        statusText: 'Возврат',
        type: 'Subscription',
        subscriptionId: 'subscription-1',
        paymentMethod: 'unknown-method',
      }),
    ]);
  });

  it('lists one page with explicit filters and emits mapped payments', async () => {
    const emissions: Array<unknown> = [];
    const sub = service.payments$.subscribe((value) => emissions.push(value));
    client.getPaymentHistory.mockResolvedValue({
      payments: [
        rpcPayment({
          id: 'payment-1',
          status: RpcPaymentStatus.COMPLETED,
          type: RpcPaymentType.SUBSCRIPTION,
        }),
      ],
      meta: { totalItems: 1, totalPages: 1, currentPage: 3, perPage: 20 },
    });

    const page = await firstValueFrom(
      service.listPayments({
        page: 3,
        limit: 20,
        searchQuery: 'payment',
        statuses: [RpcPaymentStatus.COMPLETED],
        type: RpcPaymentType.SUBSCRIPTION,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      }),
    );

    expect(client.getPaymentHistory).toHaveBeenCalledTimes(1);
    expect(client.getPaymentHistory).toHaveBeenCalledWith({
      pagination: { page: 3, limit: 20 },
      filters: {
        searchQuery: 'payment',
        statuses: [RpcPaymentStatus.COMPLETED],
        types: [RpcPaymentType.SUBSCRIPTION],
        paymentDateRange: expect.objectContaining({
          startDate: expect.any(Object),
          endDate: expect.any(Object),
        }),
      },
    });
    expect(page.payments).toEqual([
      expect.objectContaining({
        id: 'payment-1',
        status: 'completed',
        type: 'Subscription',
      }),
    ]);
    expect(emissions.at(-1)).toEqual(page.payments);
    sub.unsubscribe();
  });

  it('finds a payment by id through server search', async () => {
    client.getPaymentHistory.mockResolvedValue({
      payments: [rpcPayment({ id: 'payment-1' }), rpcPayment({ id: 'payment-2' })],
    });

    const payment = await service.getPaymentById('payment-2');

    expect(client.getPaymentHistory).toHaveBeenCalledWith({
      pagination: { page: 1, limit: 50 },
      filters: {
        searchQuery: 'payment-2',
        statuses: [],
        types: [],
        paymentDateRange: undefined,
      },
    });
    expect(payment).toEqual(expect.objectContaining({ id: 'payment-2' }));
  });

  it('returns null when getPaymentById has no match', async () => {
    client.getPaymentHistory.mockResolvedValue({ payments: [rpcPayment({ id: 'payment-1' })] });

    const payment = await service.getPaymentById('missing-payment');

    expect(payment).toBeNull();
  });

  it('creates payment and refreshes the cache', async () => {
    client.createPayment.mockResolvedValue({ paymentId: 'created-payment' });
    client.getPaymentHistory.mockResolvedValue({
      payments: [rpcPayment({ id: 'created-payment' })],
      meta: { totalPages: 1 },
    });

    const result = await service.createPayment({
      userId: 'user-1',
      amount: '5000',
      type: RpcPaymentType.ASSESSMENT,
      targetId: 'assessment-1',
    });

    expect(client.createPayment).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: '5000',
      type: RpcPaymentType.ASSESSMENT,
      targetId: 'assessment-1',
    });
    expect(result).toEqual({ paymentId: 'created-payment' });
  });

  it('updates payment, refreshes cache and returns mapped payload', async () => {
    client.updatePayment.mockResolvedValue({
      payment: rpcPayment({
        id: 'payment-1',
        amount: '999',
        status: RpcPaymentStatus.FAILED,
        type: RpcPaymentType.DOCUMENT_COPY,
      }),
    });
    client.getPaymentHistory.mockResolvedValue({
      payments: [rpcPayment({ id: 'payment-1' })],
      meta: { totalPages: 1 },
    });

    const payment = await service.updatePayment({
      id: 'payment-1',
      amount: '999',
      status: RpcPaymentStatus.FAILED,
      paymentMethod: 'invoice',
      transactionId: 'txn-1',
    });

    expect(client.updatePayment).toHaveBeenCalledWith({
      id: 'payment-1',
      amount: '999',
      status: RpcPaymentStatus.FAILED,
      paymentMethod: 'invoice',
      transactionId: 'txn-1',
      attachmentFileName: undefined,
      attachmentFileUrl: undefined,
    });
    expect(payment).toEqual(
      expect.objectContaining({
        id: 'payment-1',
        amount: 999,
        status: 'failed',
        type: 'DocumentCopy',
      }),
    );
  });

  it('throws a friendly error when update response has no payment payload', async () => {
    client.updatePayment.mockResolvedValue({});

    await expect(service.updatePayment({ id: 'payment-1' })).rejects.toThrow(
      'Сервер не вернул обновлённый платёж',
    );
  });

  it('deletes payment only when server confirms success', async () => {
    client.deletePayment.mockResolvedValue({ success: true });
    client.getPaymentHistory.mockResolvedValue({ payments: [], meta: { totalPages: 1 } });

    await expect(service.deletePayment('payment-1')).resolves.toBe(true);

    expect(client.deletePayment).toHaveBeenCalledWith({ id: 'payment-1' });
  });
});

function rpcPayment(overrides: Partial<Record<string, unknown>> = {}) {
  const basePayment = {
    id: 'payment-1',
    userId: 'user-1',
    amount: { amount: '1000', currency: 'RUB' },
    status: RpcPaymentStatus.PENDING,
    type: RpcPaymentType.ASSESSMENT,
    subscriptionId: '',
    assessmentId: '',
    paymentMethod: '',
    transactionId: '',
    attachmentFileName: '',
    attachmentFileUrl: '',
  };

  const merged = { ...basePayment, ...overrides };

  if (typeof merged.amount === 'string') {
    merged.amount = { amount: merged.amount, currency: 'RUB' };
  }

  return merged;
}

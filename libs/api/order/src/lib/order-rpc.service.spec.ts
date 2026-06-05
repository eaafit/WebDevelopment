import { Logger } from '@nestjs/common';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { OrderRpcService } from './order-rpc.service';
import type { OrderService } from './order.service';

describe('OrderRpcService', () => {
  let orderService: { findMany: jest.Mock; findOne: jest.Mock; takeOrder: jest.Mock };
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    orderService = {
      findMany: jest.fn(),
      findOne: jest.fn(),
      takeOrder: jest.fn(),
    };
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists orders with only aggregate logger fields and no raw order sample or PII', async () => {
    orderService.findMany.mockResolvedValue({
      orders: [
        {
          id: 'lead-unsafe-1',
          objectAddress: 'Secret Street 42',
          orderDate: new Date('2026-01-01T00:00:00.000Z'),
          status: 'created',
          totalAmount: '1200000',
          statusHistory: [],
          applicantId: 'applicant-unsafe-1',
          applicantName: 'Applicant Private',
          notaryId: 'notary-unsafe-1',
          notaryName: 'Notary Private',
          plannedCompletionDate: null,
          actualCompletionDate: null,
          transactionId: null,
          realEstateObject: {
            id: 'object-unsafe-1',
            address: 'Secret Object Address',
            city: 'Private City',
            area: '55.5',
            objectType: 'flat',
            roomsCount: 2,
            floor: 3,
          },
        },
      ],
      total: 1,
      totalPages: 1,
    });
    const service = new OrderRpcService(orderService as unknown as OrderService);

    const response = await service.listOrders({
      userId: 'user-unsafe-1',
      role: 'applicant',
      status: 'created',
      searchQuery: 'Secret Street',
      dateFrom: timestampFromDate(new Date('2026-01-01T00:00:00.000Z')),
      dateTo: timestampFromDate(new Date('2026-01-31T00:00:00.000Z')),
      page: 1,
      pageSize: 25,
    } as never);

    expect(response).toMatchObject({
      totalCount: 1,
      totalPages: 1,
      orders: [
        expect.objectContaining({
          id: 'lead-unsafe-1',
          applicantName: 'Applicant Private',
          objectAddress: 'Secret Street 42',
        }),
      ],
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(loggerDebugSpy).toHaveBeenCalledWith({
      operation: 'listOrders',
      ordersCount: 1,
      total: 1,
      totalPages: 1,
      hasStatusFilter: true,
      hasSearchFilter: true,
      hasDateRange: true,
    });

    const loggedPayload = JSON.stringify(loggerDebugSpy.mock.calls);
    expect(loggedPayload).not.toContain('user-unsafe-1');
    expect(loggedPayload).not.toContain('Secret Street');
    expect(loggedPayload).not.toContain('lead-unsafe-1');
    expect(loggedPayload).not.toContain('Applicant Private');
    expect(loggedPayload).not.toContain('Secret Object Address');
  });

  it('logs listOrders errors without the raw error object or request payload', async () => {
    const error = Object.assign(new Error('database failed'), {
      userId: 'user-unsafe-1',
      orderSample: { applicantName: 'Applicant Private', objectAddress: 'Secret Street 42' },
    });
    orderService.findMany.mockRejectedValue(error);
    const service = new OrderRpcService(orderService as unknown as OrderService);

    await expect(
      service.listOrders({
        userId: 'user-unsafe-1',
        role: 'applicant',
        searchQuery: 'Secret Street',
        page: 1,
        pageSize: 25,
      } as never),
    ).rejects.toThrow(error);

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith({
      operation: 'listOrders',
      result: 'error',
      error: 'Error',
    });
    const loggedPayload = JSON.stringify(loggerErrorSpy.mock.calls);
    expect(loggedPayload).not.toContain('user-unsafe-1');
    expect(loggedPayload).not.toContain('Secret Street');
    expect(loggedPayload).not.toContain('Applicant Private');
  });
});

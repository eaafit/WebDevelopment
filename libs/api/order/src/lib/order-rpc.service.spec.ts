import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { GetOrderRequest, ListOrdersRequest, TakeOrderRequest } from '@notary-portal/api-contracts';
import { OrderRpcService } from './order-rpc.service';
import type { OrderService } from './order.service';

describe('OrderRpcService', () => {
  const orderDate = new Date('2026-05-20T10:00:00.000Z');
  const orderService = {
    findMany: jest.fn(),
    findOne: jest.fn(),
    takeOrder: jest.fn(),
  } as unknown as jest.Mocked<Pick<OrderService, 'findMany' | 'findOne' | 'takeOrder'>>;

  const service = new OrderRpcService(orderService as unknown as OrderService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes normalized list filters to domain service', async () => {
    const dateFrom = timestampFromDate(new Date('2026-05-01T00:00:00.000Z'));
    const dateTo = timestampFromDate(new Date('2026-05-31T23:59:59.000Z'));
    orderService.findMany.mockResolvedValue({ orders: [], total: 0, totalPages: 1 });

    await service.listOrders({
      userId: 'user-1',
      role: 'applicant',
      status: 'created',
      searchQuery: 'Main street',
      dateFrom,
      dateTo,
      page: 2,
      pageSize: 25,
    } as ListOrdersRequest);

    expect(orderService.findMany).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'applicant',
      status: 'created',
      searchQuery: 'Main street',
      dateFrom: timestampDate(dateFrom),
      dateTo: timestampDate(dateTo),
      page: 2,
      pageSize: 25,
    });
  });

  it('maps domain orders to rpc response objects', async () => {
    orderService.findOne.mockResolvedValue({
      id: 'order-1',
      assessmentId: 'assessment-1',
      objectAddress: 'Main street, 1',
      orderDate,
      status: 'created',
      totalAmount: '1500.50',
      statusHistory: [{ status: 'created', date: orderDate, comment: 'created' }],
      applicantId: 'applicant-1',
      applicantName: 'Applicant Name',
      notaryId: null,
      notaryName: null,
      plannedCompletionDate: orderDate,
      actualCompletionDate: null,
      transactionId: null,
      realEstateObject: {
        id: 'object-1',
        address: 'Main street, 1',
        city: 'City',
        area: '42.5',
        objectType: 'flat',
        roomsCount: '2',
        floor: '3',
      },
    });

    const result = await service.getOrder({ orderId: 'order-1' } as GetOrderRequest);

    expect(result).toMatchObject({
      id: 'order-1',
      objectAddress: 'Main street, 1',
      status: 'created',
      totalAmount: 1500.5,
      applicantId: 'applicant-1',
      applicantName: 'Applicant Name',
      transactionId: undefined,
      realEstateObject: {
        id: 'object-1',
        area: 42.5,
        roomsCount: 2,
        floor: 3,
      },
    });
    expect(timestampDate(result.orderDate)).toEqual(orderDate);
    expect(timestampDate(result.statusHistory[0].date)).toEqual(orderDate);
  });

  it('wraps taken order into expected response shape', async () => {
    orderService.takeOrder.mockResolvedValue({
      id: 'order-1',
      assessmentId: 'assessment-1',
      objectAddress: 'Main street, 1',
      orderDate,
      status: 'accepted',
      totalAmount: 2000,
      statusHistory: [],
      applicantId: 'applicant-1',
      applicantName: 'Applicant Name',
      notaryId: 'notary-1',
      notaryName: 'Notary Name',
      plannedCompletionDate: orderDate,
      actualCompletionDate: undefined,
      transactionId: 'tx-1',
      realEstateObject: undefined,
    });

    const result = await service.takeOrder({
      orderId: 'order-1',
      notaryId: 'notary-1',
    } as TakeOrderRequest);

    expect(result.order).toMatchObject({
      id: 'order-1',
      status: 'accepted',
      notaryId: 'notary-1',
      transactionId: 'tx-1',
    });
  });
});

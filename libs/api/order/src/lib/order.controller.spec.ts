import { OrderController } from './order.controller';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: {
    findMany: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    orderService = {
      findMany: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new OrderController(orderService as never);
  });

  it('returns a lightweight readiness response', () => {
    expect(controller.test()).toEqual({ message: 'Order controller works' });
  });

  it('normalizes list query parameters before delegating to the service', async () => {
    const response = { orders: [], total: 0, totalPages: 0 };
    orderService.findMany.mockResolvedValue(response);

    await expect(
      controller.listOrders(
        'user-1',
        'applicant',
        'created',
        'Main street',
        '2026-05-01',
        '2026-05-30',
        '2' as unknown as number,
        '25' as unknown as number,
      ),
    ).resolves.toBe(response);

    expect(orderService.findMany).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'applicant',
      status: 'created',
      searchQuery: 'Main street',
      dateFrom: new Date('2026-05-01'),
      dateTo: new Date('2026-05-30'),
      page: 2,
      pageSize: 25,
    });
  });

  it('delegates single order lookup to the service', async () => {
    const order = { id: 'order-1' };
    orderService.findOne.mockResolvedValue(order);

    await expect(controller.getOrder('order-1')).resolves.toBe(order);

    expect(orderService.findOne).toHaveBeenCalledWith('order-1');
  });
});

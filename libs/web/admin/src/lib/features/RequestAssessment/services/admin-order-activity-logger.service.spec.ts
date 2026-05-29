import { TestBed } from '@angular/core/testing';
import { WebLoggerService } from '@notary-portal/ui';
import { AdminOrderActivityLogger } from './admin-order-activity-logger.service';

describe('AdminOrderActivityLogger', () => {
  let logger: AdminOrderActivityLogger;
  let webLogger: { info: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    webLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    TestBed.configureTestingModule({
      providers: [AdminOrderActivityLogger, { provide: WebLoggerService, useValue: webLogger }],
    });
    logger = TestBed.inject(AdminOrderActivityLogger);
  });

  it('logs card open as a structured admin_order.order_card_opened entry', () => {
    logger.logCardOpened('a-1', 'New');

    expect(webLogger.info).toHaveBeenCalledWith('admin_order.order_card_opened', {
      actorRole: 'Admin',
      action: 'order_card_opened',
      assessmentId: 'a-1',
      status: 'New',
    });
  });

  it('logs a filter change with the provided payload', () => {
    logger.logFilterChanged({ filter: 'search', value: 'Москва' });

    expect(webLogger.info).toHaveBeenCalledWith('admin_order.list_filter_changed', {
      actorRole: 'Admin',
      action: 'list_filter_changed',
      filter: 'search',
      value: 'Москва',
    });
  });

  it('logs a sort change with column and direction', () => {
    logger.logSortChanged('createdAt', 'desc');

    expect(webLogger.info).toHaveBeenCalledWith('admin_order.list_sort_changed', {
      actorRole: 'Admin',
      action: 'list_sort_changed',
      column: 'createdAt',
      direction: 'desc',
    });
  });

  it('logs an export with format and row count', () => {
    logger.logExport('csv', 12);

    expect(webLogger.info).toHaveBeenCalledWith('admin_order.list_exported', {
      actorRole: 'Admin',
      action: 'list_exported',
      format: 'csv',
      rowCount: 12,
    });
  });

  it('keeps a structured local buffer of recent entries', () => {
    logger.logCardOpened('a-1', 'New');
    logger.logExport('csv', 3);

    const entries = logger.getRecentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      actorRole: 'Admin',
      action: 'order_card_opened',
      payload: { assessmentId: 'a-1', status: 'New' },
    });
    expect(typeof entries[0].timestamp).toBe('string');
    expect(entries[1].action).toBe('list_exported');
  });

  it('caps the buffer at 50 entries (ring buffer drops oldest)', () => {
    for (let i = 0; i < 60; i++) {
      logger.logExport('csv', i);
    }

    const entries = logger.getRecentEntries();
    expect(entries).toHaveLength(50);
    // Первые 10 вытеснены: сохранены rowCount = 10..59.
    expect(entries[0].payload['rowCount']).toBe(10);
    expect(entries[49].payload['rowCount']).toBe(59);
  });

  it('returns an isolated copy of the buffer', () => {
    logger.logExport('csv', 1);

    const first = logger.getRecentEntries();
    const second = logger.getRecentEntries();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

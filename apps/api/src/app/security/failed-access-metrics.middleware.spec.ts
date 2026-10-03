import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { createFailedAccessMetricsMiddleware } from './failed-access-metrics.middleware';

describe('failed access metrics middleware', () => {
  it('records failed access metrics when a 4xx response finishes', () => {
    const metrics = {
      recordFailedAccessAttempt: jest.fn(),
    };
    const req = {
      method: 'GET',
      originalUrl: '/api/payments/failed-access-smoke-1/receipt?download=1',
    } as Request;
    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 401;
    const next = jest.fn();

    createFailedAccessMetricsMiddleware(metrics)(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(metrics.recordFailedAccessAttempt).toHaveBeenCalledWith({
      method: 'GET',
      statusCode: '401',
      reason: 'auth_denied',
      pathGroup: 'payment_receipt',
    });
  });

  it('does not record successful responses', () => {
    const metrics = {
      recordFailedAccessAttempt: jest.fn(),
    };
    const req = {
      method: 'GET',
      originalUrl: '/health',
    } as Request;
    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 200;

    createFailedAccessMetricsMiddleware(metrics)(req, res, jest.fn());
    res.emit('finish');

    expect(metrics.recordFailedAccessAttempt).not.toHaveBeenCalled();
  });
});

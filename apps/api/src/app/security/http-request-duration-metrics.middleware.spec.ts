import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import {
  createHttpRequestDurationMetricsMiddleware,
  resolveHttpRequestPathGroup,
} from './http-request-duration-metrics.middleware';

describe('http request duration metrics middleware', () => {
  it('records successful auth RPC duration when the response finishes', () => {
    const metrics = {
      recordHttpRequestDuration: jest.fn(),
    };
    const req = {
      method: 'post',
      originalUrl: '/notary.auth.v1alpha1.AuthService/Register?token=raw-secret',
    } as Request;
    const res = new EventEmitter() as Response & EventEmitter;
    const next = jest.fn();
    const now = createClock([10, 10.125]);
    res.statusCode = 200;

    createHttpRequestDurationMetricsMiddleware(metrics, now)(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(metrics.recordHttpRequestDuration).toHaveBeenCalledWith(
      'POST',
      'auth_register',
      '200',
      expect.any(Number),
    );
    expect(metrics.recordHttpRequestDuration.mock.calls[0][3]).toBeCloseTo(0.125);
  });

  it('records failed auth RPC duration when the response finishes', () => {
    const metrics = {
      recordHttpRequestDuration: jest.fn(),
    };
    const req = {
      method: 'POST',
      originalUrl: '/notary.auth.v1alpha1.AuthService/Login',
    } as Request;
    const res = new EventEmitter() as Response & EventEmitter;
    const now = createClock([1, 1.5]);
    res.statusCode = 401;

    createHttpRequestDurationMetricsMiddleware(metrics, now)(req, res, jest.fn());
    res.emit('finish');

    expect(metrics.recordHttpRequestDuration).toHaveBeenCalledWith(
      'POST',
      'auth_login',
      '401',
      expect.any(Number),
    );
    expect(metrics.recordHttpRequestDuration.mock.calls[0][3]).toBeCloseTo(0.5);
  });

  it('uses only low-cardinality path groups in labels', () => {
    const metrics = {
      recordHttpRequestDuration: jest.fn(),
    };
    const req = {
      method: 'GET',
      originalUrl: '/api/users/123?resetToken=raw-secret',
    } as Request;
    const res = new EventEmitter() as Response & EventEmitter;
    const now = createClock([3, 3.025]);
    res.statusCode = 404;

    createHttpRequestDurationMetricsMiddleware(metrics, now)(req, res, jest.fn());
    res.emit('finish');

    expect(metrics.recordHttpRequestDuration).toHaveBeenCalledWith(
      'GET',
      'other',
      '404',
      expect.any(Number),
    );
    expect(JSON.stringify(metrics.recordHttpRequestDuration.mock.calls)).not.toContain(
      '/api/users/123',
    );
    expect(JSON.stringify(metrics.recordHttpRequestDuration.mock.calls)).not.toContain(
      'raw-secret',
    );
  });

  it('maps health and metrics endpoints to stable path groups', () => {
    expect(resolveHttpRequestPathGroup({ originalUrl: '/health' })).toBe('health');
    expect(resolveHttpRequestPathGroup({ originalUrl: '/metrics' })).toBe('metrics');
  });
});

function createClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

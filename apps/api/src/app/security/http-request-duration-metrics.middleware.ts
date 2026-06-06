import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { HttpRequestMetricPathGroup, MetricsService } from '@internal/metrics';
import { sanitizeRequestPath } from '../logging/logging.config';

type HttpRequestDurationMetricsRecorder = Pick<MetricsService, 'recordHttpRequestDuration'>;
type NowSeconds = () => number;

export interface HttpRequestDurationRequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
}

export function createHttpRequestDurationMetricsMiddleware(
  metrics: HttpRequestDurationMetricsRecorder,
  nowSeconds: NowSeconds = defaultNowSeconds,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = nowSeconds();

    res.on('finish', () => {
      metrics.recordHttpRequestDuration(
        normalizeMethod(req.method),
        resolveHttpRequestPathGroup(req),
        String(res.statusCode),
        nowSeconds() - startedAt,
      );
    });

    next();
  };
}

export function resolveHttpRequestPathGroup(
  req: HttpRequestDurationRequestLike,
): HttpRequestMetricPathGroup {
  const path = sanitizeRequestPath(req.originalUrl ?? req.url);

  if (path === '/notary.auth.v1alpha1.AuthService/Login') {
    return 'auth_login';
  }

  if (path === '/notary.auth.v1alpha1.AuthService/Register') {
    return 'auth_register';
  }

  if (path === '/notary.auth.v1alpha1.AuthService/ForgotPassword') {
    return 'auth_password_reset_request';
  }

  if (path === '/notary.auth.v1alpha1.AuthService/ResetPassword') {
    return 'auth_password_reset_submit';
  }

  if (path === '/health') {
    return 'health';
  }

  if (path === '/metrics') {
    return 'metrics';
  }

  return 'other';
}

function normalizeMethod(method: string | undefined): string {
  return method?.trim().toUpperCase() || 'UNKNOWN';
}

function defaultNowSeconds(): number {
  return performance.now() / 1000;
}

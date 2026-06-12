import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from '@internal/metrics';
import { resolveFailedAccessMetricLabels } from './failed-access-metric-labels';

type FailedAccessMetricsRecorder = Pick<MetricsService, 'recordFailedAccessAttempt'>;

export function createFailedAccessMetricsMiddleware(metrics: FailedAccessMetricsRecorder) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      const labels = resolveFailedAccessMetricLabels(req, res.statusCode);

      if (labels) {
        metrics.recordFailedAccessAttempt(labels);
      }
    });

    next();
  };
}

import { register } from 'prom-client';
import { MetricsService } from '@internal/metrics';

describe('failed access Prometheus metrics', () => {
  beforeEach(() => {
    register.clear();
  });

  afterEach(() => {
    register.clear();
  });

  it('exports failed access attempts with low-cardinality labels', async () => {
    const metrics = new MetricsService();

    metrics.recordFailedAccessAttempt({
      method: 'GET',
      statusCode: '404',
      reason: 'scan_miss',
      pathGroup: 'other',
    });

    await expect(metrics.getMetrics()).resolves.toContain(
      [
        'notary_failed_access_total{method="GET",status_code="404"',
        ',reason="scan_miss",path_group="other"} 1',
      ].join(''),
    );
  });
});

import { register } from 'prom-client';
import { MetricsService } from '@internal/metrics';

describe('http request duration Prometheus metrics', () => {
  beforeEach(() => {
    register.clear();
  });

  afterEach(() => {
    register.clear();
  });

  it('exports request duration histogram with low-cardinality labels', async () => {
    const metrics = new MetricsService();

    metrics.recordHttpRequestDuration('POST', 'auth_login', '200', 0.25);

    const output = await metrics.getMetrics();

    expect(output).toContain('notary_http_request_duration_seconds_bucket');
    expect(output).toContain('notary_http_request_duration_seconds_sum');
    expect(output).toContain('notary_http_request_duration_seconds_count');
    expect(output).toContain('method="POST"');
    expect(output).toContain('path_group="auth_login"');
    expect(output).toContain('status_code="200"');
    expect(output).not.toContain('/notary.auth.v1alpha1.AuthService/Login');
  });
});

import { register } from 'prom-client';
import { MetricsService } from '@internal/metrics';

describe('auth Prometheus metrics', () => {
  beforeEach(() => {
    register.clear();
  });

  afterEach(() => {
    register.clear();
  });

  it('exports auth counters with low-cardinality labels', async () => {
    const metrics = new MetricsService();

    metrics.recordAuthLogin('success');
    metrics.recordAuthLogin('failed', 'invalid_password');
    metrics.recordAuthRegistration('success', 'applicant');
    metrics.recordAuthRegistration('failed', 'notary', 'email_already_registered');
    metrics.recordAuthPasswordReset('request', 'success');
    metrics.recordAuthPasswordReset('submit', 'failed', 'invalid_or_expired_token');

    const output = await metrics.getMetrics();

    expect(output).toContain(
      'notary_auth_login_total{outcome="success",reason="none"} 1',
    );
    expect(output).toContain(
      'notary_auth_login_total{outcome="failed",reason="invalid_password"} 1',
    );
    expect(output).toContain(
      'notary_auth_registration_total{outcome="success",role="applicant",reason="none"} 1',
    );
    expect(output).toContain(
      [
        'notary_auth_registration_total{outcome="failed",role="notary",',
        'reason="email_already_registered"} 1',
      ].join(''),
    );
    expect(output).toContain(
      'notary_auth_password_reset_total{stage="request",outcome="success",reason="none"} 1',
    );
    expect(output).toContain(
      [
        'notary_auth_password_reset_total{stage="submit",outcome="failed",',
        'reason="invalid_or_expired_token"} 1',
      ].join(''),
    );
  });
});

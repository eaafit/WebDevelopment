import {
  resolveFailedAccessMetricLabels,
  resolveFailedAccessPathGroup,
} from './failed-access-metric-labels';

describe('failed access metric labels', () => {
  it('classifies failed login attempts on the Connect RPC login endpoint', () => {
    expect(
      resolveFailedAccessMetricLabels(
        { method: 'post', url: '/notary.auth.v1alpha1.AuthService/Login' },
        401,
      ),
    ).toEqual({
      method: 'POST',
      statusCode: '401',
      reason: 'failed_login',
      pathGroup: 'auth_login',
    });
  });

  it('classifies protected receipt denials without using payment ids as labels', () => {
    expect(
      resolveFailedAccessMetricLabels(
        { method: 'GET', originalUrl: '/api/payments/codex-smoke-1/receipt?download=1' },
        401,
      ),
    ).toEqual({
      method: 'GET',
      statusCode: '401',
      reason: 'auth_denied',
      pathGroup: 'payment_receipt',
    });
  });

  it('classifies unknown 404 paths as scan misses', () => {
    expect(
      resolveFailedAccessMetricLabels({ method: 'GET', url: '/codex-bot-scan-1' }, 404),
    ).toEqual({
      method: 'GET',
      statusCode: '404',
      reason: 'scan_miss',
      pathGroup: 'other',
    });
  });

  it('classifies known API and Connect paths into low-cardinality groups', () => {
    expect(resolveFailedAccessPathGroup('/api/documents/document-1/content')).toBe(
      'document_content',
    );
    expect(resolveFailedAccessPathGroup('/api/admin/users')).toBe('api');
    expect(resolveFailedAccessPathGroup('/notary.audit.v1.AuditService/ListEvents')).toBe(
      'connect_rpc',
    );
  });

  it('ignores successful responses and server errors', () => {
    expect(resolveFailedAccessMetricLabels({ method: 'GET', url: '/health' }, 200)).toBeNull();
    expect(resolveFailedAccessMetricLabels({ method: 'GET', url: '/api/boom' }, 500)).toBeNull();
  });
});

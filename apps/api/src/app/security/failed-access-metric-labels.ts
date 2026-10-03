import type {
  FailedAccessMetricLabels,
  FailedAccessMetricPathGroup,
  FailedAccessMetricReason,
} from '@internal/metrics';
import { sanitizeRequestPath } from '../logging/logging.config';

export interface FailedAccessRequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
}

export function resolveFailedAccessMetricLabels(
  req: FailedAccessRequestLike,
  statusCode: number,
): FailedAccessMetricLabels | null {
  if (statusCode < 400 || statusCode >= 500) {
    return null;
  }

  const path = sanitizeRequestPath(req.originalUrl ?? req.url);
  const pathGroup = resolveFailedAccessPathGroup(path);

  return {
    method: normalizeMethod(req.method),
    statusCode: String(statusCode),
    reason: resolveFailedAccessReason(statusCode, pathGroup),
    pathGroup,
  };
}

export function resolveFailedAccessPathGroup(path: string): FailedAccessMetricPathGroup {
  if (path === '/notary.auth.v1alpha1.AuthService/Login') {
    return 'auth_login';
  }

  if (/^\/api\/payments\/[^/]+\/receipt$/.test(path)) {
    return 'payment_receipt';
  }

  if (/^\/api\/documents\/[^/]+\/content$/.test(path)) {
    return 'document_content';
  }

  if (path.startsWith('/notary.')) {
    return 'connect_rpc';
  }

  if (path.startsWith('/api/')) {
    return 'api';
  }

  return 'other';
}

function resolveFailedAccessReason(
  statusCode: number,
  pathGroup: FailedAccessMetricPathGroup,
): FailedAccessMetricReason {
  if ((statusCode === 401 || statusCode === 403) && pathGroup === 'auth_login') {
    return 'failed_login';
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'auth_denied';
  }

  if (statusCode === 404) {
    return 'scan_miss';
  }

  if (statusCode === 429) {
    return 'rate_limited';
  }

  return 'client_error';
}

function normalizeMethod(method: string | undefined): string {
  return method?.trim().toUpperCase() || 'UNKNOWN';
}

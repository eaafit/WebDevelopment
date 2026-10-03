import { Code, ConnectError } from '@connectrpc/connect';
import { UserRole } from '@notary-portal/ui';

const EXPECTED_AUTH_CODES = new Set<Code>([
  Code.InvalidArgument,
  Code.Unauthenticated,
  Code.PermissionDenied,
  Code.AlreadyExists,
  Code.NotFound,
]);

export interface AuthBrowserLogContext {
  emailDomain?: string;
  role?: string;
  reason?: string;
  hasSession?: boolean;
  route?: string;
  outcome?: 'submitted' | 'succeeded' | 'failed';
  errorName?: string;
  errorCode?: string;
}

export function buildAuthLogContext(values: AuthBrowserLogContext): AuthBrowserLogContext {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== ''),
  ) as AuthBrowserLogContext;
}

export function emailDomainOf(email: string | null | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0 || atIndex === normalized.length - 1) {
    return undefined;
  }

  return normalized.slice(atIndex + 1);
}

export function authRoleName(role: number | UserRole | null | undefined): string | undefined {
  switch (role) {
    case UserRole.Applicant:
      return 'applicant';
    case UserRole.Notary:
      return 'notary';
    case UserRole.Admin:
      return 'admin';
    default:
      return undefined;
  }
}

export function currentBrowserRoute(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.pathname || undefined;
}

export function isExpectedAuthError(error: unknown): boolean {
  return error instanceof ConnectError && EXPECTED_AUTH_CODES.has(error.code);
}

export function authErrorLogContext(error: unknown): AuthBrowserLogContext {
  if (error instanceof ConnectError) {
    return buildAuthLogContext({
      reason: `rpc_${connectCodeName(error.code)}`,
      errorName: 'ConnectError',
      errorCode: connectCodeName(error.code),
    });
  }

  if (error instanceof Error) {
    return buildAuthLogContext({
      reason: 'unexpected_error',
      errorName: error.name || 'Error',
    });
  }

  return { reason: 'unexpected_error' };
}

function connectCodeName(code: Code): string {
  return (Code[code] ?? String(code)).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

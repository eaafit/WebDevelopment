import { Code, ConnectError } from '@connectrpc/connect';
import { getCurrentUser } from './request-context';

export const Role = {
  Applicant: 'USER_ROLE_APPLICANT',
  Notary: 'USER_ROLE_NOTARY',
  Admin: 'USER_ROLE_ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    throw new ConnectError('authentication required', Code.Unauthenticated);
  }
  return user;
}

export function requireRole(...roles: Role[]) {
  const user = requireAuth();
  const userRole = normalizeRole(user.role);

  if (!roles.includes(userRole)) {
    throw new ConnectError(
      `access denied: required role(s) [${roles.join(', ')}], got ${userRole}`,
      Code.PermissionDenied,
    );
  }

  return user;
}

export function requireSelfOrRole(resourceOwnerId: string, ...roles: Role[]) {
  const user = requireAuth();
  const userRole = normalizeRole(user.role);

  if (user.sub === resourceOwnerId) return user;
  if (roles.includes(userRole)) return user;

  throw new ConnectError(
    'access denied: you can only access your own resources',
    Code.PermissionDenied,
  );
}

function normalizeRole(role: string): Role {
  const numericMap: Record<string, Role> = {
    '1': Role.Applicant,
    '2': Role.Notary,
    '3': Role.Admin,
  };
  const directMap: Record<string, Role> = {
    USER_ROLE_APPLICANT: Role.Applicant,
    USER_ROLE_NOTARY: Role.Notary,
    USER_ROLE_ADMIN: Role.Admin,
  };
  return numericMap[role] ?? directMap[role] ?? Role.Applicant;
}

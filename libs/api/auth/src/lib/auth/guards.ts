import { Code, ConnectError } from '@connectrpc/connect';
import { getCurrentUser } from './request-context';

// ─── Роли (зеркалят UserRole из proto) ──────────────────────────────────────

export const Role = {
  Applicant: 'USER_ROLE_APPLICANT',
  Notary:    'USER_ROLE_NOTARY',
  Admin:     'USER_ROLE_ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ─── Хелперы для проверки ролей ──────────────────────────────────────────────

/**
 * Требует аутентификации. Бросает Unauthenticated если запрос анонимный.
 * Возвращает payload текущего пользователя.
 */
export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    throw new ConnectError('authentication required', Code.Unauthenticated);
  }
  return user;
}

/**
 * Требует одну из переданных ролей.
 * Бросает Unauthenticated если анонимный, PermissionDenied если не та роль.
 */
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

/**
 * Проверяет что пользователь либо имеет нужную роль,
 * либо является владельцем ресурса (его id совпадает с resourceOwnerId).
 * Используется для методов типа "можно смотреть свой профиль, или быть Admin".
 */
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

// ─── Нормализация строкового role из JWT payload ─────────────────────────────
// В JWT payload role хранится как число (enum value), конвертируем в строку.

function normalizeRole(role: string): Role {
  // JWT payload хранит числовое значение enum как строку: "1", "2", "3"
  const numericMap: Record<string, Role> = {
    '1': Role.Applicant,
    '2': Role.Notary,
    '3': Role.Admin,
  };
  // Или напрямую строковое значение
  const directMap: Record<string, Role> = {
    'USER_ROLE_APPLICANT': Role.Applicant,
    'USER_ROLE_NOTARY':    Role.Notary,
    'USER_ROLE_ADMIN':     Role.Admin,
  };
  return numericMap[role] ?? directMap[role] ?? Role.Applicant;
}

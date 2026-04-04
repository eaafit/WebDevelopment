// Устаревший файл — весь контент перенесён в token-store.ts
// Оставлен для сохранения экспорта из index.ts без изменений.
export {
  UserRole,
  USER_ROLE_HOME,
  parseJwtPayload,
  isTokenExpired,
  roleFromPayload,
  TokenStore,
} from './token-store';
export type { AuthUser, JwtPayload } from './token-store';

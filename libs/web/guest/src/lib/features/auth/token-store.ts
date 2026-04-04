// TokenStore перенесён в @notary-portal/ui для разрыва циклических зависимостей.
// Этот файл — обратная совместимость: реэкспортирует из ui.
export {
  TokenStore,
  UserRole,
  USER_ROLE_HOME,
  parseJwtPayload,
  isTokenExpired,
  roleFromPayload,
} from '@notary-portal/ui';
export type { AuthUser, JwtPayload } from '@notary-portal/ui';

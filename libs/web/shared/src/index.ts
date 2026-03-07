// ─── @notary-portal/shared ────────────────────────────────────────────────────
// Фасадный entry-point для общих web-утилит.
//
// Граф зависимостей (без циклов):
//   @notary-portal/ui        ← TokenStore, RPC_TRANSPORT, guards, модели
//   @notary-portal/guest     ← AuthService, Login (импортирует из ui)
//   @notary-portal/shared    ← реэкспортирует из ui (удобный алиас)

// Auth tokens & state
export { TokenStore, UserRole, USER_ROLE_HOME, parseJwtPayload, isTokenExpired, roleFromPayload } from '@notary-portal/ui';
export type { AuthUser, JwtPayload } from '@notary-portal/ui';

// RPC transport
export { RPC_TRANSPORT, provideRpcTransport, buildRpcBaseUrl, createAuthInterceptor } from '@notary-portal/ui';
export type { RpcTransportOptions } from '@notary-portal/ui';

// Guards
export { authGuard, roleGuard } from '@notary-portal/ui';

# OAuth-вход через внешние сервисы (Google)

Вертикальный срез входа/регистрации через Google OAuth2 / OpenID Connect.
Часть зоны авторизации (issue-02). На этом этапе реализован **только Google**;
Яндекс и ВК добавляются по этому же шаблону (generic-поле `provider` в RPC).

## Поток данных

```
[Фронт] кнопка «Войти через Google» (login/register)
   │  AuthService.getGoogleAuthorizeUrl()
   ▼
[RPC] AuthService.GetOAuthAuthorizeUrl { provider } ─> OAuthService.getAuthorizeUrl
   │     • OAuthStateService.issue() — подписанный HMAC-state
   │     • GoogleOAuthClient.buildAuthorizeUrl(state)
   ◀─ { url, state }   (фронт кладёт state в sessionStorage, редиректит на url)
   ▼
[Google] экран согласия ─> redirect на GOOGLE_REDIRECT_URI (/auth/oauth/google/callback)
   │  OAuthCallback читает code+state из query, сверяет state с sessionStorage
   ▼
[RPC] AuthService.OAuthLogin { provider, code, state } ─> OAuthService.login
   │     1. OAuthStateService.verify(state)            — CSRF
   │     2. GoogleOAuthClient.exchangeCode(code)       — code → токены Google
   │     3. GoogleOAuthClient.getUserInfo(accessToken) — профиль (sub/email/...)
   │     4. find-or-create:
   │        • привязанный OAuthAccount → вход
   │        • существующий email + email_verified → связка OAuthAccount → вход
   │        • новый пользователь → создание (роль Applicant, без пароля) → регистрация
   │     5. TokenService.generateTokenPair — НАШИ JWT (токен Google не отдаётся)
   ◀─ AuthResult { access_token, refresh_token, user }
   ▼
[Фронт] TokenStore.setTokens + редирект по USER_ROLE_HOME[role] — как обычный логин
```

## Ключевые файлы

| Файл | Роль |
|---|---|
| `google-oauth.client.ts` | Сетевой клиент Google (authorize URL, code→token, userinfo) на `fetch` |
| `oauth-state.service.ts` | Подписанный stateless CSRF-state (HMAC + TTL) |
| `oauth-account.repository.ts` | Доступ к `oauth_accounts`, создание пользователя без пароля |
| `oauth.service.ts` | Оркестратор: find-or-create, выдача JWT, аудит |
| `auth-rpc.service.ts` | RPC-обёртки `getOAuthAuthorizeUrl` / `oAuthLogin` |

БД: таблица `oauth_accounts` (`provider` + `provider_user_id`, `@@unique`) и
`users.password_hash` стал nullable (миграция `*_add_oauth_account`).

## Аудит

По эталону `auth.service.ts`. Через `AuditService.record`:
`user.oauth_login_succeeded`, `user.oauth_registered`,
`user.oauth_login_failed` (провалы — `allowAnonymous: true`, `targetType` `Security`/`User`).
В payload пишутся только `provider/outcome/reason/email/role` — **никогда**
`code`, `access_token`, `id_token`, `client_secret`.

## Конфигурация (env)

| Переменная | Назначение |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth-клиент из Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4200/auth/oauth/google/callback` (совпадает с Console) |
| `OAUTH_STATE_SECRET` | секрет подписи state; в проде обязателен, вне прода fallback на `JWT_ACCESS_SECRET` (с warn) |
| `OAUTH_STATE_TTL_SEC` | срок жизни state, по умолчанию 600 |

## Как протестировать локально

1. Google Cloud Console → OAuth client (Web) → Authorized redirect URI =
   `http://localhost:4200/auth/oauth/google/callback`.
2. Заполнить `GOOGLE_*` и `OAUTH_STATE_SECRET` в `.env` (см. `.env.example`).
3. БД поднята; применить миграции (`prisma migrate deploy`) и `prisma generate`.
4. `pnpm dev` (api + web), открыть `http://localhost:4200/auth`,
   нажать «Войти через Google».
5. Проверить аудит (`/admin/monitoring` или таблица `audit_logs`): событие
   `user.oauth_registered` / `user.oauth_login_succeeded`, без секретов в `details`.

# OAuth-вход через внешние сервисы (Google / Яндекс / ВК)

Вертикальный срез входа/регистрации через внешних OAuth-провайдеров.
Часть зоны авторизации (issue-02). Реализованы **Google**, **Яндекс** и **ВК (VK ID)**
поверх общего интерфейса `OAuthClient` и реестра клиентов в `OAuthService`
(generic-поле `provider` в RPC — отдельных RPC на провайдера нет).

## Провайдеры

| Провайдер | Поток | Особенности |
|---|---|---|
| Google | authorization code | `openid email profile`, userinfo по Bearer |
| Яндекс | authorization code | `login:email login:info`, `default_email`, userinfo по `Authorization: OAuth` |
| ВК (VK ID) | authorization code + **PKCE (S256)** | обязателен `code_verifier` (прячем в подписанный state) и `device_id` (приходит в callback, поле `device_id` в `OAuthLoginRequest`) |

Новый клиент = реализация `OAuthClient` (`buildAuthorizeUrl`/`exchangeCode`/`getUserInfo`,
опц. `createPkce`) + запись в реестре `OAuthService` + DI в `auth.module.ts`.

## VK: ограничения живого демо

Код VK ID реализован полностью (`VkOAuthClient`: PKCE S256, `device_id`, `user_info`) и **покрыт
тестами** (`vk-oauth.client.spec.ts`, VK-ветка в `oauth.service.spec.ts`). Generic-флоу доказан
**вживую end-to-end на Google и Яндексе** (consent → callback → вход/регистрация → аудит).

Живое демо именно VK ID на локальной машине **недоступно** из-за требований самого VK ID
(не код, внешние ограничения):
- регистрация приложения авторизации требует **VK Бизнес ID-профиль с ИНН** (бизнес-верификация);
- Trusted Redirect URL обязан быть **`https`**, а для `localhost` — только порт **80/443**
  (форма отклоняет и `http://localhost:4200/...`, и `https://localhost:4200/...`).

Наш dev-стенд отдаёт фронт по `http://localhost:4200`, поэтому redirect `…/auth/oauth/vk/callback`
VK не принимает. Чтобы провести живое демо VK позднее, нужен публичный **https**-адрес
(туннель ngrok/cloudflared на `:4200` либо web по `https` на `:443`) — прописать его в
`VK_REDIRECT_URI` и в Trusted Redirect URL приложения VK ID. Контракт и клиент к этому готовы:
достаточно задать `VK_CLIENT_ID`/`VK_REDIRECT_URI` (и при необходимости `VK_CLIENT_SECRET`) в `.env`.

## Подтверждение контакта после OAuth

После **новой OAuth-регистрации** или **первой связки** с существующим аккаунтом вход не завершается
сразу: пользователь должен подтвердить контакт 6-значным кодом (живёт 5 мин). Повторные входы уже
привязанного и подтверждённого аккаунта код не запрашивают.

```
OAuthLogin (новая регистрация / первая связка)
  → OAuthService создаёт/связывает юзера, НО токены не выдаёт:
    upsert ContactVerification(codeHash, expiresAt, attempts=0) + код в лог api
    ← { verification_required: true, verification_ticket, contact_to_verify }
  → фронт ведёт на /auth/verify-contact (а не в кабинет)
ConfirmContact { ticket, code }
  → проверка ticket → запись по userId → не истёк / attempts<лимит / код совпал
  → confirmedAt=now, выдаются НАШИ JWT, internal-уведомление, аудит user.contact_confirmed
ResendContactCode { ticket }  → новый код (старый инвалидируется); серверный кулдаун 60с против перебора
```

- **Гейт** — таблица `contact_verifications` (одна строка на юзера). `confirmedAt != null` — контакт
  подтверждён (durable). Брошенное подтверждение → повторный OAuth-вход снова требует код.
- **Код** — 6 цифр, криптослучайный, в БД хранится SHA-256-хэш. Доставка dev — `LogContactCodeMailer`
  (NestJS Logger): `Код подтверждения для <email>: <код>`. SMTP не подключаем.
- **Безопасность** — код НИКОГДА не попадает в аудит/RPC-ответы/на фронт; `ticket` — короткий HMAC,
  коду не равен и в БД не хранится; лимит попыток + серверный кулдаун resend (анти-brute-force).
- Аудит: `user.contact_verification_sent`, `user.contact_confirmed`, `user.contact_confirmation_failed`
  (reason invalid_code|expired|attempts_exceeded|resend_too_soon|invalid_ticket).
- env: `CONTACT_CODE_TTL_SEC`, `CONTACT_CODE_MAX_ATTEMPTS`, `CONTACT_CODE_RESEND_COOLDOWN_SEC`, `CONTACT_TICKET_TTL_SEC`.

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
| `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` | приложение из oauth.yandex.ru (права email + login) |
| `YANDEX_REDIRECT_URI` | `http://localhost:4200/auth/oauth/yandex/callback` |
| `VK_CLIENT_ID` | приложение из id.vk.ru (VK ID) |
| `VK_REDIRECT_URI` | `http://localhost:4200/auth/oauth/vk/callback` (Trusted redirect URL в консоли) |
| `VK_CLIENT_SECRET` | опционально — только если тип VK-приложения требует секрет (PKCE его заменяет) |
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

/**
 * Единый контракт низкоуровневого клиента OAuth-провайдера.
 * Реализации (Google/Yandex/VK) различаются только endpoints, scopes и форматом
 * ответа. Бизнес-логики и аудита здесь нет; токены провайдера наружу не отдаются.
 */

/** Нормализованный профиль пользователя от внешнего провайдера. */
export interface OAuthUserInfo {
  /** Стабильный идентификатор пользователя у провайдера. */
  providerUserId: string;
  /** Email пользователя. Может быть пустым, если провайдер не вернул адрес. */
  email: string;
  /** Подтверждён ли email на стороне провайдера. */
  emailVerified: boolean;
  fullName: string;
}

/** Параметры обмена authorization code на токены. */
export interface OAuthCodeExchange {
  code: string;
  /** PKCE code_verifier (нужен VK ID). */
  codeVerifier?: string;
  /** device_id, выданный провайдером на callback (нужен VK ID). */
  deviceId?: string;
}

/** PKCE-пара (метод S256). */
export interface OAuthPkce {
  verifier: string;
  challenge: string;
}

/** Результат обмена: наружу отдаётся только access_token для запроса профиля. */
export interface OAuthTokens {
  accessToken: string;
}

/**
 * Сетевой клиент OAuth-провайдера. `createPkce` объявляется только у провайдеров,
 * которым PKCE обязателен (VK ID); у остальных метод отсутствует.
 */
export interface OAuthClient {
  /** Возвращает PKCE-пару, если провайдер её требует. */
  createPkce?(): OAuthPkce;
  /** URL согласия. `state` уже подписан вызывающей стороной; `codeChallenge` — при PKCE. */
  buildAuthorizeUrl(state: string, codeChallenge?: string): string;
  /** Обмен authorization code на токены (server-to-server). */
  exchangeCode(input: OAuthCodeExchange): Promise<OAuthTokens>;
  /** Профиль пользователя по access_token. */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

/** Ошибка сетевого обмена с провайдером. Сообщение НЕ содержит code/token/secret. */
export class OAuthClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OAuthClientError';
  }
}

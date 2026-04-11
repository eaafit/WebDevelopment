export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
export enum OAuthProvider {
  UNSPECIFIED = 'unspecified',
  VK = 'vk',
  GOOGLE = 'google',
  APPLE = 'apple',
  YANDEX = 'yandex',
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  redirectUri: string;
  scopes: string[];
}

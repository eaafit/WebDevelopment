import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';
import { Injectable } from '@nestjs/common';
import { REQUEST_IP_CONTEXT_KEY, requestContextStorage } from '@internal/auth-shared';
import { TokenService } from './token.service';

// ─── Публичные методы (без авторизации) ─────────────────────────────────────
// Указываем в формате "ServiceName/MethodName" — именно так формируется URL в ConnectRPC.

const PUBLIC_METHODS = new Set([
  'notary.auth.v1alpha1.AuthService/Register',
  'notary.auth.v1alpha1.AuthService/Login',
  'notary.auth.v1alpha1.AuthService/RefreshToken',
  'notary.auth.v1alpha1.AuthService/ForgotPassword',
  'notary.auth.v1alpha1.AuthService/ResetPassword',
]);

@Injectable()
export class AuthInterceptor {
  constructor(private readonly tokenService: TokenService) {}

  // ─── Interceptor factory ─────────────────────────────────────────────────
  // Возвращает ConnectRPC Interceptor — используется в connectNodeAdapter.

  build(): Interceptor {
    return (next) => async (req) => {
      const methodKey = `${req.service.typeName}/${req.method.name}`;
      const metadata = {
        ip: req.contextValues.get(REQUEST_IP_CONTEXT_KEY),
        userAgent: req.header.get('user-agent'),
      };

      // Публичные методы — пропускаем без проверки токена
      if (PUBLIC_METHODS.has(methodKey)) {
        return requestContextStorage.run({ user: null, metadata }, () => next(req));
      }

      // Читаем Bearer token из Authorization header
      const authHeader = req.header.get('authorization') ?? req.header.get('Authorization');
      const token = extractBearer(authHeader);

      if (!token) {
        throw new ConnectError('missing or malformed Authorization header', Code.Unauthenticated);
      }

      // Верифицируем токен
      let payload;
      try {
        payload = this.tokenService.verifyAccessToken(token);
      } catch {
        throw new ConnectError('invalid or expired access token', Code.Unauthenticated);
      }

      // Прокидываем payload в AsyncLocalStorage на время выполнения запроса
      return requestContextStorage.run({ user: payload, metadata }, () => next(req));
    };
  }
}

// ─── Хелпер: извлечение токена из Bearer-схемы ──────────────────────────────

function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

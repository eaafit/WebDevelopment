import { Injectable } from '@nestjs/common';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthService } from './auth.service';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GetOAuthAuthorizeUrlRequest,
  GetOAuthAuthorizeUrlResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  OAuthLoginRequest,
  OAuthLoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class AuthRpcService {
  constructor(private readonly authService: AuthService) {}

  readonly register     = (r: RegisterRequest):     Promise<RegisterResponse>     =>
    this.authService.register(r);

  readonly login        = (r: LoginRequest):        Promise<LoginResponse>        =>
    this.authService.login(r);

  readonly refreshToken = (r: RefreshTokenRequest): Promise<RefreshTokenResponse> =>
    this.authService.refreshToken(r);

  readonly logout       = (r: LogoutRequest):       Promise<LogoutResponse>       =>
    this.authService.logout(r);

  readonly forgotPassword = (r: ForgotPasswordRequest): Promise<ForgotPasswordResponse> =>
    this.authService.forgotPassword(r);

  readonly resetPassword = (r: ResetPasswordRequest): Promise<ResetPasswordResponse> =>
    this.authService.resetPassword(r);

  // OAuth — заглушки (реальная реализация подключается в следующем коммите вместе с OAuthService).
  readonly getOAuthAuthorizeUrl = (
    _r: GetOAuthAuthorizeUrlRequest,
  ): Promise<GetOAuthAuthorizeUrlResponse> => {
    throw new ConnectError('OAuth authorize URL is not implemented yet', Code.Unimplemented);
  };

  readonly oAuthLogin = (_r: OAuthLoginRequest): Promise<OAuthLoginResponse> => {
    throw new ConnectError('OAuth login is not implemented yet', Code.Unimplemented);
  };
}

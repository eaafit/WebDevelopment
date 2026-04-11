import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  OAuthInitRequest,
  OAuthInitResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class AuthRpcService {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

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

  readonly oauthInit = (r: OAuthInitRequest): Promise<OAuthInitResponse> =>
    this.oauthService.oauthInit(r);

  readonly oauthCallback = (r: OAuthCallbackRequest): Promise<OAuthCallbackResponse> =>
    this.oauthService.oauthCallback(r);
}

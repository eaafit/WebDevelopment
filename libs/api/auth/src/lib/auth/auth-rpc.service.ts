import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
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
}

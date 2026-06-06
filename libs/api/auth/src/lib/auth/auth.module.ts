import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';
import { PrismaModule } from '@internal/prisma';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { AuthRpcService } from './auth-rpc.service';
import { AuthInterceptor } from './auth.interceptor';
import { GoogleOAuthClient } from './google-oauth.client';
import { YandexOAuthClient } from './yandex-oauth.client';
import { VkOAuthClient } from './vk-oauth.client';
import { OAuthStateService } from './oauth-state.service';
import { OAuthAccountRepository } from './oauth-account.repository';
import { OAuthService } from './oauth.service';
import { ContactVerificationRepository } from './contact-verification.repository';
import { CONTACT_CODE_MAILER } from './contact-code-mailer.interface';
import { LogContactCodeMailer } from './log-contact-code-mailer';

@Module({
  imports: [PrismaModule, AuditModule, NotificationModule],
  providers: [
    AuthRepository,
    RefreshTokenRepository,
    PasswordResetRepository,
    PasswordService,
    TokenService,
    AuthService,
    AuthRpcService,
    AuthInterceptor,
    GoogleOAuthClient,
    YandexOAuthClient,
    VkOAuthClient,
    OAuthStateService,
    OAuthAccountRepository,
    OAuthService,
    ContactVerificationRepository,
    { provide: CONTACT_CODE_MAILER, useClass: LogContactCodeMailer },
  ],
  exports: [AuthRpcService, TokenService, AuthInterceptor, PasswordService],
})
export class AuthModule {}

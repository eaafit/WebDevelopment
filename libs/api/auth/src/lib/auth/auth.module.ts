import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { PrismaModule } from '@internal/prisma';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { AuthRpcService } from './auth-rpc.service';
import { AuthInterceptor } from './auth.interceptor';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [
    AuthRepository,
    RefreshTokenRepository,
    PasswordResetRepository,
    PasswordService,
    TokenService,
    AuthService,
    AuthRpcService,
    AuthInterceptor,
  ],
  exports: [AuthRpcService, TokenService, AuthInterceptor, PasswordService],
})
export class AuthModule {}

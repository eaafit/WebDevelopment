import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { UserRpcService } from './user-rpc.service';

@Module({
  imports: [PrismaModule],
  providers: [UserRepository, UserService, UserRpcService],
  exports: [UserRpcService],
})
export class UserModule {}

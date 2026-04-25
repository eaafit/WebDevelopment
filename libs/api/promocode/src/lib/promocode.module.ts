import { Module } from '@nestjs/common';
import { PromocodeController } from './promocode.controller';
import { PromocodeService } from './promocode.service';
import { PrismaModule } from '@notary-portal/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [PromocodeController],
  providers: [PromocodeService],
  exports: [PromocodeService],
})
export class PromocodeModule {}

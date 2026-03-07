import { Module } from '@nestjs/common';
import { BillingModule } from '@internal/billing';
import { PrismaModule } from '@internal/prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

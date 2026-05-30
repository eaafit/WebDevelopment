import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { createNestLoggerParams } from './logging.config';

@Module({
  imports: [LoggerModule.forRoot(createNestLoggerParams())],
})
export class LoggingModule {}

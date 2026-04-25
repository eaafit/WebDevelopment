import { Global, Module } from '@nestjs/common';
import { PASSWORD_RESET_MAILER, TRANSACTIONAL_MAILER } from '@internal/auth';
import { MailSenderService } from './mail-sender.service';

@Global()
@Module({
  providers: [
    MailSenderService,
    { provide: PASSWORD_RESET_MAILER, useExisting: MailSenderService },
    { provide: TRANSACTIONAL_MAILER, useExisting: MailSenderService },
  ],
  exports: [PASSWORD_RESET_MAILER, TRANSACTIONAL_MAILER],
})
export class MailModule {}

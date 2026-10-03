import { Injectable, Logger } from '@nestjs/common';
import type { ContactCodeMailer } from './contact-code-mailer.interface';

/**
 * Dev-реализация доставки кода: структурный лог api (NestJS Logger).
 * SMTP не подключаем — код виден разработчику в логах сервера и нигде больше.
 */
@Injectable()
export class LogContactCodeMailer implements ContactCodeMailer {
  private readonly logger = new Logger('ContactCodeMailer');

  async sendCode(email: string, code: string): Promise<void> {
    this.logger.log(`Код подтверждения для ${email}: ${code}`);
  }
}

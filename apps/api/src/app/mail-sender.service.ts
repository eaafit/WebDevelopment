import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { PasswordResetMailer } from '@internal/auth';

@Injectable()
export class MailSenderService implements PasswordResetMailer {
  private readonly transporter: Transporter | null;

  constructor() {
    const host = process.env['SMTP_HOST'];
    const port = process.env['SMTP_PORT'] ? Number(process.env['SMTP_PORT']) : undefined;
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];
    if (host && user && pass != null && pass !== '') {
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
    }
  }

  async sendResetLink(to: string, resetUrl: string): Promise<void> {
    const from =
      process.env['MAIL_FROM']?.trim() ||
      process.env['SMTP_USER']?.trim() ||
      'noreply@notary-portal.local';
    const appName = process.env['APP_NAME']?.trim() || 'Notary portal';
    if (!this.transporter) {
      console.warn('[MailSender] SMTP не настроен — ссылка сброса пароля:', resetUrl);
      return;
    }
    await this.transporter.sendMail({
      from: `"${appName}" <${from}>`,
      to,
      subject: `Восстановление пароля — ${appName}`,
      text: `Здравствуйте.\n\nПерейдите по ссылке, чтобы задать новый пароль:\n\n${resetUrl}\n\nСсылка действует ограниченное время. Если вы не запрашивали сброс, проигнорируйте это письмо.\n\n— ${appName}`,
      html: `
        <p>Здравствуйте.</p>
        <p><a href="${escapeHtml(resetUrl)}">Перейдите по ссылке</a>, чтобы задать новый пароль.</p>
        <p>Ссылка действует ограниченное время. Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
        <p>— ${escapeHtml(appName)}</p>
      `.trim(),
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { Injectable } from '@nestjs/common';
import emailjs from '@emailjs/nodejs';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { PasswordResetMailer, TransactionalMailer, WelcomeMailPayload } from '@internal/auth';
import type { NewsletterMailer, NewsletterMailPayload } from '@internal/newsletter';

type ResolvedTransport = 'smtp' | 'emailjs' | 'none';

export interface SentMailJournalItem {
  id: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  sentAt: string;
  fromEmail: string;
  toEmail: string;
  transport: string;
  previewUrl: string | null;
}

@Injectable()
export class MailSenderService implements PasswordResetMailer, TransactionalMailer, NewsletterMailer {
  private readonly sentMailJournal: SentMailJournalItem[] = [];
  private readonly transporter: Transporter | null;
  private readonly transport: ResolvedTransport;
  private readonly emailjsCore: { serviceId: string; publicKey: string; privateKey: string } | null;
  private readonly templatePasswordReset: string | null;
  private readonly templateWelcome: string | null;
  private readonly templateApplicantRequest: string | null;
  private readonly templateStaffNewRequest: string | null;
  private readonly staffNotifyTo: string | null;

  constructor() {
    const host = process.env['SMTP_HOST'];
    const port = process.env['SMTP_PORT'] ? Number(process.env['SMTP_PORT']) : undefined;
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];

    if (host) {
      const auth = user && pass ? { auth: { user, pass } } : {};
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: port === 465,
        ...auth,
      });
    } else {
      this.transporter = null;
    }

    this.emailjsCore = this.readEmailjsCore();
    this.templatePasswordReset = process.env['EMAILJS_TEMPLATE_PASSWORD_RESET']?.trim() || null;
    this.templateWelcome = process.env['EMAILJS_TEMPLATE_WELCOME_REGISTERED']?.trim() || null;
    this.templateApplicantRequest =
      process.env['EMAILJS_TEMPLATE_APPLICANT_REQUEST']?.trim() || null;
    this.templateStaffNewRequest =
      process.env['EMAILJS_TEMPLATE_STAFF_NEW_REQUEST']?.trim() || null;
    this.staffNotifyTo = process.env['EMAILJS_STAFF_NOTIFY_TO']?.trim() || null;

    const raw = (process.env['MAIL_TRANSPORT'] ?? 'auto').toLowerCase();
    const emailjsReady = Boolean(this.emailjsCore && this.templatePasswordReset);
    const smtpReady = this.transporter !== null;

    if (raw === 'emailjs') {
      this.transport = emailjsReady ? 'emailjs' : 'none';
      if (!emailjsReady) {
        console.warn(
          '[MailSender] MAIL_TRANSPORT=emailjs, но не заданы EMAILJS_SERVICE_ID, ключи или EMAILJS_TEMPLATE_PASSWORD_RESET',
        );
      }
    } else if (raw === 'smtp') {
      this.transport = smtpReady ? 'smtp' : 'none';
      if (!smtpReady) {
        console.warn('[MailSender] MAIL_TRANSPORT=smtp, но SMTP не настроен');
      }
    } else {
      if (emailjsReady) this.transport = 'emailjs';
      else if (smtpReady) this.transport = 'smtp';
      else this.transport = 'none';
    }

    if (this.transport === 'emailjs' && this.emailjsCore) {
      emailjs.init({
        publicKey: this.emailjsCore.publicKey,
        privateKey: this.emailjsCore.privateKey,
      });
    }
  }

  private readEmailjsCore(): { serviceId: string; publicKey: string; privateKey: string } | null {
    const serviceId = process.env['EMAILJS_SERVICE_ID']?.trim();
    const publicKey = process.env['EMAILJS_PUBLIC_KEY']?.trim();
    const privateKey = process.env['EMAILJS_PRIVATE_KEY']?.trim();
    if (!serviceId || !publicKey || !privateKey) return null;
    return { serviceId, publicKey, privateKey };
  }

  private appName(): string {
    return process.env['APP_NAME']?.trim() || 'Notary portal';
  }

  private mailFrom(): string {
    return (
      process.env['MAIL_FROM']?.trim() ||
      process.env['SMTP_USER']?.trim() ||
      'noreply@notary-portal.local'
    );
  }

  async sendResetLink(to: string, resetUrl: string): Promise<void> {
    const appName = this.appName();
    if (this.transport === 'emailjs' && this.emailjsCore && this.templatePasswordReset) {
      await emailjs.send(
        this.emailjsCore.serviceId,
        this.templatePasswordReset,
        {
          to_email: to,
          reset_url: resetUrl,
          app_name: appName,
        },
        {
          publicKey: this.emailjsCore.publicKey,
          privateKey: this.emailjsCore.privateKey,
        },
      );
      return;
    }

    if (this.transport === 'smtp' && this.transporter) {
      const from = this.mailFrom();
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
      return;
    }

    console.warn('[MailSender] Почта не настроена — ссылка сброса пароля:', resetUrl);
  }

  async sendWelcomeAfterRegistration(payload: WelcomeMailPayload): Promise<void> {
    const appName = this.appName();

    if (this.transport === 'emailjs' && this.emailjsCore && this.templateWelcome) {
      await emailjs.send(
        this.emailjsCore.serviceId,
        this.templateWelcome,
        {
          to_email: payload.email,
          full_name: payload.fullName,
          role_label: payload.roleLabel,
          app_name: appName,
          login_url: payload.loginUrl,
        },
        {
          publicKey: this.emailjsCore.publicKey,
          privateKey: this.emailjsCore.privateKey,
        },
      );
      return;
    }

    if (this.transport === 'smtp' && this.transporter) {
      const from = this.mailFrom();
      const subject = `Добро пожаловать в ${appName}`;
      const text = [
        `Здравствуйте, ${payload.fullName}!`,
        '',
        `Ваша учётная запись в ${appName} успешно создана.`,
        '',
        `Роль: ${payload.roleLabel}`,
        `Вход в личный кабинет: ${payload.loginUrl}`,
        '',
        'Если вы не регистрировались в сервисе, свяжитесь с поддержкой.',
        '',
        `— ${appName}`,
      ].join('\n');
      await this.transporter.sendMail({
        from: `"${appName}" <${from}>`,
        to: payload.email,
        subject,
        text,
        html: `
        <p>Здравствуйте, ${escapeHtml(payload.fullName)}!</p>
        <p>Ваша учётная запись в ${escapeHtml(appName)} успешно создана.</p>
        <p>Роль: ${escapeHtml(payload.roleLabel)}<br/>
        Вход в личный кабинет: <a href="${escapeHtml(payload.loginUrl)}">${escapeHtml(payload.loginUrl)}</a></p>
        <p>Если вы не регистрировались в сервисе, свяжитесь с поддержкой.</p>
        <p>— ${escapeHtml(appName)}</p>
      `.trim(),
      });
      return;
    }

    if (this.transport === 'emailjs' && !this.templateWelcome) {
      console.warn(
        '[MailSender] Пропуск приветственного письма: задайте EMAILJS_TEMPLATE_WELCOME_REGISTERED',
      );
      return;
    }

    console.warn('[MailSender] Пропуск приветственного письма: почта не настроена');
  }

  /**
   * Вызов после создания заявки на сервере (например из RPC). Клиентская форма до появления API
   * может дублировать логику через EmailJS в браузере.
   */
  async sendApplicantRequestConfirmation(params: {
    applicantEmail: string;
    fullName: string;
    requestSummary: string;
    submittedAt: string;
    ordersUrl: string;
  }): Promise<void> {
    const appName = this.appName();
    const keys = this.emailjsCore;

    if (keys && this.templateApplicantRequest) {
      if (this.transport !== 'emailjs') {
        emailjs.init({ publicKey: keys.publicKey, privateKey: keys.privateKey });
      }
      await emailjs.send(
        keys.serviceId,
        this.templateApplicantRequest,
        {
          to_email: params.applicantEmail,
          full_name: params.fullName,
          request_summary: params.requestSummary,
          submitted_at: params.submittedAt,
          app_name: appName,
          orders_url: params.ordersUrl,
        },
        { publicKey: keys.publicKey, privateKey: keys.privateKey },
      );
      return;
    }

    if (this.transporter) {
      const from = this.mailFrom();
      const subject = `${appName} — заявка принята`;
      const text = [
        `Здравствуйте, ${params.fullName}!`,
        '',
        'Мы получили вашу заявку.',
        '',
        'Кратко о запросе:',
        params.requestSummary,
        '',
        `Дата и время отправки: ${params.submittedAt}`,
        '',
        `Отслеживать статус: ${params.ordersUrl}`,
        '',
        `— ${appName}`,
      ].join('\n');
      await this.transporter.sendMail({
        from: `"${appName}" <${from}>`,
        to: params.applicantEmail,
        subject,
        text,
        html: `
        <p>Здравствуйте, ${escapeHtml(params.fullName)}!</p>
        <p>Мы получили вашу заявку.</p>
        <p><strong>Кратко о запросе:</strong><br/><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(params.requestSummary)}</pre></p>
        <p>Дата и время отправки: ${escapeHtml(params.submittedAt)}</p>
        <p><a href="${escapeHtml(params.ordersUrl)}">Мои заявки</a></p>
        <p>— ${escapeHtml(appName)}</p>
      `.trim(),
      });
      return;
    }

    console.warn(
      '[MailSender] Пропуск подтверждения заявки заявителю: почта или шаблон не настроены',
    );
  }

  async notifyStaffNewRequest(params: {
    applicantEmail: string;
    fullName: string;
    requestSummary: string;
    submittedAt: string;
    staffToEmail?: string;
  }): Promise<void> {
    const appName = this.appName();
    const to = (params.staffToEmail ?? this.staffNotifyTo)?.trim();
    if (!to) {
      console.warn(
        '[MailSender] Пропуск уведомления сотруднику: задайте EMAILJS_STAFF_NOTIFY_TO или staffToEmail',
      );
      return;
    }

    const keys = this.emailjsCore;

    if (keys && this.templateStaffNewRequest) {
      if (this.transport !== 'emailjs') {
        emailjs.init({ publicKey: keys.publicKey, privateKey: keys.privateKey });
      }
      await emailjs.send(
        keys.serviceId,
        this.templateStaffNewRequest,
        {
          to_email: to,
          applicant_email: params.applicantEmail,
          full_name: params.fullName,
          request_summary: params.requestSummary,
          submitted_at: params.submittedAt,
          app_name: appName,
        },
        { publicKey: keys.publicKey, privateKey: keys.privateKey },
      );
      return;
    }

    if (this.transporter) {
      const from = this.mailFrom();
      const subject = `[${appName}] Новая заявка от заявителя`;
      const text = [
        'Поступила новая заявка.',
        '',
        `Заявитель: ${params.fullName} (${params.applicantEmail})`,
        '',
        'Содержание:',
        params.requestSummary,
        '',
        `Время: ${params.submittedAt}`,
      ].join('\n');
      await this.transporter.sendMail({
        from: `"${appName}" <${from}>`,
        to,
        subject,
        text,
        html: `
        <p>Поступила новая заявка.</p>
        <p>Заявитель: ${escapeHtml(params.fullName)} (${escapeHtml(params.applicantEmail)})</p>
        <p><strong>Содержание:</strong><br/><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(params.requestSummary)}</pre></p>
        <p>Время: ${escapeHtml(params.submittedAt)}</p>
      `.trim(),
      });
      return;
    }

    console.warn('[MailSender] Пропуск уведомления сотруднику: почта или шаблон не настроены');
  }

  async sendNewsletterEmail(payload: NewsletterMailPayload): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transport is not configured');
    }

    const appName = this.appName();
    const from = this.mailFrom();
    const safeFullName = payload.fullName.trim() || payload.to;
    const text = newsletterTextFallback(payload.bodyHtml, safeFullName, appName);

    const info = await this.transporter.sendMail({
      from: `"${appName}" <${from}>`,
      to: payload.to,
      subject: payload.subject,
      text,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
          <p>Здравствуйте, ${escapeHtml(safeFullName)}!</p>
          <div>${payload.bodyHtml}</div>
          <p style="margin-top:24px;color:#6b7280">— ${escapeHtml(appName)}</p>
        </div>
      `.trim(),
    });

    this.rememberSentMail({
      subject: payload.subject,
      bodyText: text,
      bodyHtml: payload.bodyHtml,
      fromEmail: from,
      toEmail: payload.to,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
    });
  }

  listSentMailJournal(): SentMailJournalItem[] {
    return [...this.sentMailJournal];
  }

  private rememberSentMail(input: {
    subject: string;
    bodyText: string;
    bodyHtml: string;
    fromEmail: string;
    toEmail: string;
    previewUrl: string | null;
  }): void {
    this.sentMailJournal.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      sentAt: new Date().toISOString(),
      fromEmail: input.fromEmail,
      toEmail: input.toEmail,
      transport: this.transport,
      previewUrl: input.previewUrl,
    });

    if (this.sentMailJournal.length > 50) {
      this.sentMailJournal.length = 50;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function newsletterTextFallback(bodyHtml: string, fullName: string, appName: string): string {
  const text = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  return [`Здравствуйте, ${fullName}!`, '', text, '', `— ${appName}`].join('\n');
}

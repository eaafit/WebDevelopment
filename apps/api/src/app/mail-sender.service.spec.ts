const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
const mockEmailjsInit = jest.fn();
const mockEmailjsSend = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

jest.mock('@emailjs/nodejs', () => ({
  __esModule: true,
  default: {
    init: mockEmailjsInit,
    send: mockEmailjsSend,
  },
}));

import { MailSenderService } from './mail-sender.service';

type SentMail = {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

describe('MailSenderService auth emails', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue(undefined);
    process.env = {
      ...originalEnv,
      APP_NAME: 'Нотариальная оценка',
      MAIL_FROM: 'robot@notary.local',
      MAIL_TRANSPORT: 'smtp',
      PASSWORD_RESET_TTL_SEC: '3600',
      SMTP_HOST: 'smtp.local',
      SMTP_PORT: '2525',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends a premium HTML password reset email with escaped reset URL', async () => {
    const service = new MailSenderService();
    const resetUrl = 'https://notary.local/auth/reset-password?token=<unsafe>&next="x"';

    await service.sendResetLink('user@example.com', resetUrl);

    const mail = mockSendMail.mock.calls[0]?.[0] as SentMail;
    expect(mail.subject).toBe('Восстановление пароля — Нотариальная оценка');
    expect(mail.to).toBe('user@example.com');
    expect(mail.text).toContain(resetUrl);
    expect(mail.html).toContain('Задать новый пароль');
    expect(mail.html).toContain('display:inline-block');
    expect(mail.html).toContain('60 минут');
    expect(mail.html).toContain(
      'https://notary.local/auth/reset-password?token=&lt;unsafe&gt;&amp;next=&quot;x&quot;',
    );
    expect(mail.html).not.toContain('token=<unsafe>');
  });

  it('does not log password reset URLs when mail transport is disabled', async () => {
    process.env = {
      ...originalEnv,
      APP_NAME: 'Нотариальная оценка',
      MAIL_FROM: 'robot@notary.local',
      MAIL_TRANSPORT: 'none',
      PASSWORD_RESET_TTL_SEC: '3600',
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new MailSenderService();
    const resetUrl = 'https://notary.local/auth/reset-password?token=raw-reset-token';

    await service.sendResetLink('user@example.com', resetUrl);

    expect(warnSpy).toHaveBeenCalledWith(
      '[MailSender] Почта не настроена; ссылка сброса пароля не логируется',
    );
    const warnPayload = JSON.stringify(warnSpy.mock.calls);
    expect(warnPayload).not.toContain('raw-reset-token');
    expect(warnPayload).not.toContain('/auth/reset-password');
    warnSpy.mockRestore();
  });

  it('sends a premium HTML welcome email with escaped user fields and text fallback', async () => {
    const service = new MailSenderService();

    await service.sendWelcomeAfterRegistration({
      email: 'ivan@example.com',
      fullName: 'Иван <Admin>',
      loginUrl: 'https://notary.local/auth?next=<home>',
      roleLabel: 'Нотариус & эксперт',
    });

    const mail = mockSendMail.mock.calls[0]?.[0] as SentMail;
    expect(mail.subject).toBe('Добро пожаловать в Нотариальная оценка');
    expect(mail.to).toBe('ivan@example.com');
    expect(mail.text).toContain('Здравствуйте, Иван <Admin>!');
    expect(mail.text).toContain('Вход в личный кабинет: https://notary.local/auth?next=<home>');
    expect(mail.html).toContain('Войти в личный кабинет');
    expect(mail.html).toContain('Иван &lt;Admin&gt;');
    expect(mail.html).toContain('Нотариус &amp; эксперт');
    expect(mail.html).toContain('https://notary.local/auth?next=&lt;home&gt;');
    expect(mail.html).not.toContain('Иван <Admin>');
  });
});

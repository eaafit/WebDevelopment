import { Injectable, computed, signal } from '@angular/core';

export type SmtpEncryptionType = 'None' | 'SSL' | 'TLS' | 'STARTTLS';

export interface SmtpClientUi {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  encryptionType: SmtpEncryptionType;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  updatedAt: string;
}

interface CreateSmtpClientInput {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  encryptionType: SmtpEncryptionType;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
}

const INITIAL_SMTP_CLIENTS: SmtpClientUi[] = [
  {
    id: 'smtp-001',
    name: 'Основной SMTP (SendGrid)',
    host: 'smtp.sendgrid.net',
    port: 587,
    username: 'mailer-admin',
    password: '••••••••',
    encryptionType: 'STARTTLS',
    fromEmail: 'noreply@notary-portal.local',
    fromName: 'Нотариальный портал',
    isActive: true,
    updatedAt: '2026-03-20 10:15',
  },
  {
    id: 'smtp-002',
    name: 'Резервный SMTP (Yandex)',
    host: 'smtp.yandex.ru',
    port: 465,
    username: 'backup-mailer',
    password: '••••••••',
    encryptionType: 'SSL',
    fromEmail: 'backup@notary-portal.local',
    fromName: 'Notary Backup Mailer',
    isActive: true,
    updatedAt: '2026-03-18 18:20',
  },
  {
    id: 'smtp-003',
    name: 'Тестовый профиль',
    host: 'smtp.mailhog.local',
    port: 1025,
    username: 'test-user',
    password: '••••••••',
    encryptionType: 'None',
    fromEmail: 'dev@notary-portal.local',
    fromName: 'Dev Sender',
    isActive: false,
    updatedAt: '2026-03-11 09:05',
  },
];

@Injectable({ providedIn: 'root' })
export class NewsletterUiStoreService {
  private readonly smtpClientsState = signal<SmtpClientUi[]>([...INITIAL_SMTP_CLIENTS]);

  readonly smtpClients = computed(() => this.smtpClientsState());

  readonly activeSmtpClients = computed(() =>
    this.smtpClientsState().filter((client) => client.isActive),
  );

  findSmtpClientById(id: string): SmtpClientUi | undefined {
    return this.smtpClientsState().find((client) => client.id === id);
  }

  createSmtpClient(input: CreateSmtpClientInput): SmtpClientUi {
    const next: SmtpClientUi = {
      id: this.generateId(),
      ...input,
      updatedAt: this.formatNow(),
    };

    this.smtpClientsState.update((clients) => [next, ...clients]);

    return next;
  }

  updateSmtpClient(id: string, patch: Partial<CreateSmtpClientInput>): void {
    this.smtpClientsState.update((clients) =>
      clients.map((client) =>
        client.id === id
          ? {
              ...client,
              ...patch,
              updatedAt: this.formatNow(),
            }
          : client,
      ),
    );
  }

  setSmtpClientActive(id: string, isActive: boolean): void {
    this.updateSmtpClient(id, { isActive });
  }

  deleteSmtpClient(id: string): void {
    this.smtpClientsState.update((clients) => clients.filter((client) => client.id !== id));
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `smtp-${crypto.randomUUID()}`;
    }

    return `smtp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  private formatNow(): string {
    return new Date().toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import {
  NewsletterUiStoreService,
  type SmtpClientUi,
  type SmtpEncryptionType,
} from '../newsletter/newsletter-ui-store.service';

interface SmtpFormState {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  encryptionType: SmtpEncryptionType;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
}

const DEFAULT_FORM: SmtpFormState = {
  name: '',
  host: '',
  port: '587',
  username: '',
  password: '',
  encryptionType: 'STARTTLS',
  fromEmail: '',
  fromName: '',
  isActive: true,
};

@Component({
  selector: 'lib-smtp-settings',
  standalone: true,
  imports: [],
  templateUrl: './smtp-settings.html',
  styleUrl: './smtp-settings.scss',
})
export class SmtpSettings {
  private readonly store = inject(NewsletterUiStoreService);

  protected readonly smtpClients = this.store.smtpClients;

  protected readonly form = signal<SmtpFormState>({ ...DEFAULT_FORM });
  protected readonly editingId = signal<string | null>(null);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly statusMessage = signal<string>(
    'Настройте SMTP-профили для отправки email-рассылок.',
  );

  protected readonly isEditing = computed(() => this.editingId() !== null);
  protected readonly activeCount = computed(
    () => this.smtpClients().filter((client) => client.isActive).length,
  );

  protected updateForm<K extends keyof SmtpFormState>(key: K, value: SmtpFormState[K]): void {
    this.form.update((prev) => ({ ...prev, [key]: value }));
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((prev) => !prev);
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...DEFAULT_FORM });
    this.showPassword.set(false);
    this.statusMessage.set('Создание нового SMTP-профиля.');
  }

  protected startEdit(client: SmtpClientUi): void {
    this.editingId.set(client.id);
    this.form.set({
      name: client.name,
      host: client.host,
      port: String(client.port),
      username: client.username,
      password: '',
      encryptionType: client.encryptionType,
      fromEmail: client.fromEmail,
      fromName: client.fromName,
      isActive: client.isActive,
    });
    this.showPassword.set(false);
    this.statusMessage.set(`Редактирование профиля «${client.name}».`);
  }

  protected cancelEdit(): void {
    this.startCreate();
    this.statusMessage.set('Редактирование отменено.');
  }

  protected saveProfile(): void {
    const form = this.form();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.name.trim() || !form.host.trim() || !form.username.trim() || !form.fromEmail.trim()) {
      this.statusMessage.set(
        'Заполните обязательные поля: имя профиля, host, login и email отправителя.',
      );
      return;
    }

    if (!emailPattern.test(form.fromEmail.trim())) {
      this.statusMessage.set('Введите корректный адрес отправителя.');
      return;
    }

    const port = Number(form.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      this.statusMessage.set('Укажите корректный SMTP-порт (1-65535).');
      return;
    }

    const editingId = this.editingId();

    if (editingId) {
      const existing = this.store.findSmtpClientById(editingId);
      if (!existing) {
        this.statusMessage.set('Профиль не найден. Обновите страницу и попробуйте снова.');
        return;
      }

      this.store.updateSmtpClient(editingId, {
        name: form.name.trim(),
        host: form.host.trim(),
        port,
        username: form.username.trim(),
        password: form.password.trim() || existing.password,
        encryptionType: form.encryptionType,
        fromEmail: form.fromEmail.trim(),
        fromName: form.fromName.trim(),
        isActive: form.isActive,
      });

      const updatedMessage = `SMTP-профиль «${form.name.trim()}» обновлён.`;
      this.startCreate();
      this.statusMessage.set(updatedMessage);
      return;
    }

    if (!form.password.trim()) {
      this.statusMessage.set('Для нового профиля необходимо указать пароль.');
      return;
    }

    const created = this.store.createSmtpClient({
      name: form.name.trim(),
      host: form.host.trim(),
      port,
      username: form.username.trim(),
      password: form.password.trim(),
      encryptionType: form.encryptionType,
      fromEmail: form.fromEmail.trim(),
      fromName: form.fromName.trim(),
      isActive: form.isActive,
    });

    const createdMessage = `SMTP-профиль «${created.name}» создан.`;
    this.startCreate();
    this.statusMessage.set(createdMessage);
  }

  protected toggleProfileActive(client: SmtpClientUi): void {
    this.store.setSmtpClientActive(client.id, !client.isActive);

    this.statusMessage.set(
      !client.isActive
        ? `Профиль «${client.name}» активирован.`
        : `Профиль «${client.name}» деактивирован.`,
    );
  }

  protected removeProfile(client: SmtpClientUi): void {
    this.store.deleteSmtpClient(client.id);

    if (this.editingId() === client.id) {
      this.startCreate();
    }

    this.statusMessage.set(`Профиль «${client.name}» удалён.`);
  }
}

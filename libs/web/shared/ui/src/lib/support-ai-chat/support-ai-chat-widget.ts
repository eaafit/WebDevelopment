import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConnectError, createClient } from '@connectrpc/connect';
import { SupportService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '../rpc/rpc-transport';
import type { SupportAiChatLayout, SupportChatMessage } from './support-ai-chat.models';

// Генерирует id сообщения в браузере (с fallback для старых окружений).
function createMessageId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Создаёт объект сообщения для transcript.
function buildMessage(role: SupportChatMessage['role'], text: string): SupportChatMessage {
  return {
    id: createMessageId(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

@Component({
  selector: 'lib-support-ai-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support-ai-chat-widget.html',
  styleUrl: './support-ai-chat-widget.css',
})
export class SupportAiChatWidget implements OnInit {
  // true — виджет сам вызывает AskSupportAi через Connect; false — только messageSubmit родителю.
  readonly useBackendAi = input(false);
  // floating: FAB + панель; inline: только панель.
  readonly layout = input<SupportAiChatLayout>('floating');
  // Открыть панель сразу (удобно для inline-демо).
  readonly defaultOpen = input(false);
  // Заголовок панели чата.
  readonly title = input('Техподдержка');
  // Подзаголовок под заголовком.
  readonly subtitle = input('ИИ-помощник по нотариату и оценке');
  // Placeholder поля ввода.
  readonly placeholder = input('Задайте вопрос по порталу…');
  // Текст кнопки отправки.
  readonly sendLabel = input('Отправить');
  // Полная блокировка виджета (например, на время техработ).
  readonly disabled = input(false);
  // Блокировать отправку пустого текста.
  readonly requireNonEmpty = input(true);

  // Событие после отправки — родитель может логировать вопрос (guest: onSupportDraftSubmit).
  readonly messageSubmit = output<string>();
  // Состояние открытия панели (для аналитики / внешнего UI).
  readonly openChange = output<boolean>();

  // Лента сообщений user | assistant.
  protected readonly transcript = signal<SupportChatMessage[]>([]);
  // Индикатор «ИИ думает…» во время RPC.
  protected readonly aiLoading = signal(false);
  // Панель раскрыта (FAB нажат или defaultOpen).
  protected readonly panelOpen = signal(false);
  // Текущий черновик в textarea.
  protected draft = '';

  // Connect-клиент создаётся лениво при useBackendAi и наличии RPC_TRANSPORT.
  private readonly rpcTransport = inject(RPC_TRANSPORT, { optional: true });
  private supportClient: ReturnType<typeof createClient<typeof SupportService>> | null = null;

  ngOnInit(): void {
    // Применяем defaultOpen к начальному состоянию панели.
    if (this.defaultOpen()) {
      this.panelOpen.set(true);
      this.openChange.emit(true);
    }
  }

  // Переключение панели в режиме floating.
  protected togglePanel(): void {
    if (this.disabled()) {
      return;
    }
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    this.openChange.emit(next);
  }

  // Закрытие панели и уведомление родителя.
  protected closePanel(): void {
    this.panelOpen.set(false);
    this.openChange.emit(false);
  }

  // Можно ли отправить: не disabled, не loading, текст не пустой (если requireNonEmpty).
  protected canSend(): boolean {
    if (this.disabled() || this.aiLoading()) {
      return false;
    }
    const text = this.draft.trim();
    if (this.requireNonEmpty() && !text) {
      return false;
    }
    return true;
  }

  // Enter — отправка; Shift+Enter — новая строка (обрабатывается в шаблоне).
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.submitDraft();
    }
  }

  // Основной поток отправки: transcript → RPC или только output → ответ в ленту.
  protected async submitDraft(): Promise<void> {
    if (!this.canSend()) {
      return;
    }

    const text = this.draft.trim();
    this.draft = '';

    this.transcript.update((items) => [...items, buildMessage('user', text)]);
    this.messageSubmit.emit(text);

    if (!this.useBackendAi()) {
      return;
    }

    await this.requestAiAnswer(text);
  }

  // Вызов AskSupportAi и добавление ответа или ошибки как assistant.
  private async requestAiAnswer(text: string): Promise<void> {
    const client = this.getSupportClient();
    if (!client) {
      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', 'Сервис временно недоступен. Проверьте подключение к API.'),
      ]);
      return;
    }

    this.aiLoading.set(true);
    try {
      const response = await client.askSupportAi({ questionText: text });
      const answer = response.answerText?.trim();
      if (answer) {
        this.transcript.update((items) => [...items, buildMessage('assistant', answer)]);
        return;
      }

      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', 'Сервис временно недоступен. Попробуйте позже или обратитесь в поддержку.'),
      ]);
    } catch (error: unknown) {
      const fallback = 'Сервис временно недоступен. Попробуйте позже или обратитесь в поддержку.';
      const message =
        error instanceof ConnectError
          ? error.rawMessage || error.message || fallback
          : error instanceof Error
            ? error.message || fallback
            : fallback;
      this.transcript.update((items) => [...items, buildMessage('assistant', message)]);
    } finally {
      this.aiLoading.set(false);
    }
  }

  // Ленивая инициализация Connect-клиента SupportService.
  private getSupportClient(): ReturnType<typeof createClient<typeof SupportService>> | null {
    if (!this.rpcTransport) {
      return null;
    }
    if (!this.supportClient) {
      this.supportClient = createClient(SupportService, this.rpcTransport);
    }
    return this.supportClient;
  }
}

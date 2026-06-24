import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  MessageRole,
  SupportService,
  type TicketMessage as RpcTicketMessage,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '../rpc/rpc-transport';
import { TokenStore } from '../rpc/token-store';
import type {
  SupportAiChatLayout,
  SupportChatMessage,
  SupportChatMode,
} from './support-ai-chat.models';

const POLL_INTERVAL_MS = 7000;
const DEFAULT_OPERATOR_SUBTITLE = 'Ожидайте ответа оператора';

function createMessageId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildMessage(
  role: SupportChatMessage['role'],
  text: string,
  meta?: Pick<SupportChatMessage, 'authorName' | 'label'>,
): SupportChatMessage {
  return {
    id: createMessageId(),
    role,
    text,
    createdAt: new Date().toISOString(),
    ...meta,
  };
}

function roleLabel(role: SupportChatMessage['role']): string {
  switch (role) {
    case 'support':
      return 'Оператор';
    case 'assistant':
      return 'ИИ-помощник';
    case 'user':
    default:
      return 'Вы';
  }
}

function mapRpcRole(role: MessageRole): SupportChatMessage['role'] {
  switch (role) {
    case MessageRole.SUPPORT:
      return 'support';
    case MessageRole.AI:
      return 'assistant';
    case MessageRole.USER:
    default:
      return 'user';
  }
}

@Component({
  selector: 'lib-support-ai-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support-ai-chat-widget.html',
  styleUrl: './support-ai-chat-widget.css',
})
export class SupportAiChatWidget implements OnInit, OnDestroy {
  readonly useBackendAi = input(false);
  readonly layout = input<SupportAiChatLayout>('floating');
  readonly defaultOpen = input(false);
  readonly title = input('Техподдержка');
  readonly subtitle = input('ИИ-помощник по нотариату и оценке');
  readonly placeholder = input('Задайте вопрос по порталу…');
  readonly sendLabel = input('Отправить');
  readonly escalateLabel = input('Перейти на оператора');
  readonly disabled = input(false);
  readonly requireNonEmpty = input(true);
  // true — заявитель: полный цикл с эскалацией; false — гость (только ИИ, эскалация при JWT).
  readonly operatorChatEnabled = input(false);

  readonly messageSubmit = output<string>();
  readonly openChange = output<boolean>();

  protected readonly transcript = signal<SupportChatMessage[]>([]);
  protected readonly mode = signal<SupportChatMode>('ai');
  protected readonly panelSubtitle = signal('');
  protected readonly aiLoading = signal(false);
  protected readonly escalating = signal(false);
  protected readonly operatorSending = signal(false);
  protected readonly panelOpen = signal(false);

  protected readonly isBusy = computed(
    () => this.aiLoading() || this.escalating() || this.operatorSending(),
  );

  protected readonly canEscalateToOperator = computed(() => {
    if (this.mode() !== 'ai' || !this.useBackendAi()) {
      return false;
    }
    return this.operatorChatEnabled() || this.tokenStore.isLoggedIn();
  });

  protected readonly showEscalateSection = computed(
    () => this.mode() === 'ai' && this.transcript().length > 0 && this.useBackendAi(),
  );

  protected draft = '';

  private readonly rpcTransport = inject(RPC_TRANSPORT, { optional: true });
  private readonly tokenStore = inject(TokenStore);
  private supportClient: ReturnType<typeof createClient<typeof SupportService>> | null = null;
  private readonly ticketId = signal<string | null>(null);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.panelSubtitle.set(this.subtitle());
    if (this.defaultOpen()) {
      this.panelOpen.set(true);
      this.openChange.emit(true);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected displaySubtitle(): string {
    return this.panelSubtitle() || this.subtitle();
  }

  protected messageMeta(message: SupportChatMessage): string {
    const label = message.label ?? roleLabel(message.role);
    if (message.authorName && message.role === 'support') {
      return `${label} · ${message.authorName}`;
    }
    return label;
  }

  protected formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected togglePanel(): void {
    if (this.disabled()) {
      return;
    }
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    this.openChange.emit(next);
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
    this.openChange.emit(false);
  }

  protected canSend(): boolean {
    if (this.disabled() || this.isBusy()) {
      return false;
    }
    const text = this.draft.trim();
    if (this.requireNonEmpty() && !text) {
      return false;
    }
    return true;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.submitDraft();
    }
  }

  protected async submitDraft(): Promise<void> {
    if (!this.canSend()) {
      return;
    }

    const text = this.draft.trim();
    this.draft = '';

    if (this.mode() === 'operator') {
      await this.sendOperatorMessage(text);
      return;
    }

    this.transcript.update((items) => [...items, buildMessage('user', text)]);
    this.messageSubmit.emit(text);

    if (!this.useBackendAi()) {
      return;
    }

    await this.requestAiAnswer(text);
  }

  protected async onEscalateClick(): Promise<void> {
    if (!this.canEscalateToOperator()) {
      return;
    }
    await this.escalateToOperator();
  }

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
        this.transcript.update((items) => [
          ...items,
          buildMessage('assistant', answer, { label: 'ИИ-помощник' }),
        ]);
        return;
      }

      this.transcript.update((items) => [
        ...items,
        buildMessage(
          'assistant',
          'Сервис временно недоступен. Попробуйте позже или обратитесь в поддержку.',
        ),
      ]);
    } catch (error: unknown) {
      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', this.resolveErrorMessage(error)),
      ]);
    } finally {
      this.aiLoading.set(false);
    }
  }

  private async escalateToOperator(): Promise<void> {
    const client = this.getSupportClient();
    if (!client || this.escalating()) {
      return;
    }

    const firstUserMessage = this.transcript().find((item) => item.role === 'user');
    const subject = (firstUserMessage?.text ?? 'Обращение в поддержку').slice(0, 200);
    const history = this.transcript().map((item) => ({
      role: item.role === 'user' ? MessageRole.USER : MessageRole.AI,
      text: item.text,
    }));

    this.escalating.set(true);
    try {
      const response = await client.escalateToOperator({ subject, history });
      const ticket = response.ticket;
      if (!ticket?.id) {
        throw new Error('Тикет не создан');
      }

      this.ticketId.set(ticket.id);
      this.mode.set('operator');
      this.panelSubtitle.set(DEFAULT_OPERATOR_SUBTITLE);
      await this.syncMessagesFromServer();
      this.startPolling();
    } catch (error: unknown) {
      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', this.resolveErrorMessage(error)),
      ]);
    } finally {
      this.escalating.set(false);
    }
  }

  private async sendOperatorMessage(text: string): Promise<void> {
    const client = this.getSupportClient();
    const ticketId = this.ticketId();
    if (!client || !ticketId) {
      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', 'Сервис оператора временно недоступен.'),
      ]);
      return;
    }

    this.operatorSending.set(true);
    try {
      await client.addMessage({ ticketId, text });
      await this.syncMessagesFromServer();
    } catch (error: unknown) {
      this.transcript.update((items) => [
        ...items,
        buildMessage('assistant', this.resolveErrorMessage(error)),
      ]);
    } finally {
      this.operatorSending.set(false);
    }
  }

  private async syncMessagesFromServer(): Promise<void> {
    const client = this.getSupportClient();
    const ticketId = this.ticketId();
    if (!client || !ticketId) {
      return;
    }

    try {
      const response = await client.listMessages({
        ticketId,
        pagination: { page: 1, limit: 200 },
      });
      const messages = (response.messages ?? []).map((message) => this.toChatMessage(message));
      this.transcript.set(messages);
    } catch (error: unknown) {
      if (error instanceof ConnectError) {
        console.error('[support-ai-chat] listMessages failed', error.message);
      }
    }
  }

  private toChatMessage(message: RpcTicketMessage): SupportChatMessage {
    const role = mapRpcRole(message.role);
    return {
      id: message.id,
      role,
      text: message.text,
      createdAt: message.createdAt
        ? timestampDate(message.createdAt).toISOString()
        : new Date().toISOString(),
      authorName: message.authorName || undefined,
      label: roleLabel(role),
    };
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.syncMessagesFromServer();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private resolveErrorMessage(error: unknown): string {
    const fallback = 'Сервис временно недоступен. Попробуйте позже или обратитесь в поддержку.';
    if (error instanceof ConnectError) {
      return error.rawMessage || error.message || fallback;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

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

/**
 * UI-kit: окно технической поддержки с заделом под ИИ-агента.
 *
 * Режим `useBackendAi`: вызов `SupportService.AskSupportAi` через Connect (публичный RPC).
 * Иначе — только `(messageSubmit)` для кастомной интеграции.
 */
import { Component, EventEmitter, HostBinding, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { createClient } from '@connectrpc/connect';
import { SupportService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '../rpc/rpc-transport';

/** Вариант вёрстки: плавающий виджет или встроенный блок. */
export type SupportAiChatLayout = 'floating' | 'inline';

export type SupportChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

@Component({
  selector: 'lib-support-ai-chat-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './support-ai-chat-widget.html',
  styleUrl: './support-ai-chat-widget.css',
})
export class SupportAiChatWidget implements OnInit {
  @HostBinding('class.support-ai-chat-widget--floating')
  hostFloating = true;

  @HostBinding('class.support-ai-chat-widget--inline')
  hostInline = false;

  private readonly transport = inject(RPC_TRANSPORT, { optional: true });
  private readonly supportClient = this.transport
    ? createClient(SupportService, this.transport)
    : null;

  private _layout: SupportAiChatLayout = 'floating';

  @Input()
  set layout(value: SupportAiChatLayout) {
    this._layout = value;
    this.syncHostLayout();
  }
  get layout(): SupportAiChatLayout {
    return this._layout;
  }

  /** Вызов `AskSupportAi` на API (гость без токена; см. публичный RPC в AuthInterceptor). */
  @Input() useBackendAi = false;

  @Input() defaultOpen = false;
  @Input() title = 'Техподдержка';
  @Input() subtitle = 'ИИ-помощник';
  @Input() placeholder = 'Опишите вопрос…';
  @Input() sendLabel = 'Отправить';
  @Input() disabled = false;
  @Input() requireNonEmpty = true;

  @Output() readonly messageSubmit = new EventEmitter<string>();
  @Output() readonly openChange = new EventEmitter<boolean>();

  draft = '';
  panelOpen = false;

  readonly transcript = signal<SupportChatMessage[]>([]);
  readonly aiLoading = signal(false);

  get isFloating(): boolean {
    return this.layout === 'floating';
  }

  get showPanel(): boolean {
    return !this.isFloating || this.panelOpen;
  }

  ngOnInit(): void {
    this.syncHostLayout();
    if (this.isFloating && this.defaultOpen) {
      this.panelOpen = true;
    }
  }

  private syncHostLayout(): void {
    this.hostFloating = this.layout === 'floating';
    this.hostInline = this.layout === 'inline';
  }

  toggle(): void {
    this.panelOpen = !this.panelOpen;
    this.openChange.emit(this.panelOpen);
  }

  close(): void {
    if (!this.panelOpen) {
      return;
    }
    this.panelOpen = false;
    this.openChange.emit(false);
  }

  async submit(): Promise<void> {
    const text = this.draft.trim();
    if (this.requireNonEmpty && !text) {
      return;
    }
    if (this.disabled || this.aiLoading()) {
      return;
    }

    if (this.useBackendAi && this.supportClient) {
      this.draft = '';
      this.transcript.update((list) => [...list, { role: 'user', text }]);
      this.aiLoading.set(true);
      try {
        const res = await this.supportClient.askSupportAi({ text });
        if (res.success) {
          this.transcript.update((list) => [...list, { role: 'assistant', text: res.answer }]);
        } else {
          this.transcript.update((list) => [
            ...list,
            { role: 'assistant', text: res.errorMessage || 'Не удалось получить ответ.' },
          ]);
        }
      } catch {
        this.transcript.update((list) => [
          ...list,
          { role: 'assistant', text: 'Сервис временно недоступен. Попробуйте позже.' },
        ]);
      } finally {
        this.aiLoading.set(false);
      }
      this.messageSubmit.emit(text);
      return;
    }

    this.messageSubmit.emit(text);
    this.draft = '';
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void this.submit();
  }

  canSend(): boolean {
    if (this.disabled || this.aiLoading()) {
      return false;
    }
    if (!this.requireNonEmpty) {
      return true;
    }
    return this.draft.trim().length > 0;
  }
}

/**
 * UI-kit: окно технической поддержки с заделом под ИИ-агента.
 *
 * Назначение:
 * - Компактная панель с полем ввода вопроса и кнопкой отправки.
 * - Логика ответа ИИ и вызов API здесь не реализованы: родитель подписывается на
 *   `(messageSubmit)` и дальше передаёт текст в сервис (позже — RPC/stream к бэкенду).
 *
 * Режимы отображения (`layout`):
 * - `floating` — плавающая кнопка (FAB) + выезжающая панель справа снизу (типично для всего портала).
 * - `inline` — только панель без FAB (встраивание в страницу, боковая колонка и т.п.).
 *
 * Доступ из приложения:
 * ```ts
 * import { SupportAiChatWidget } from '@notary-portal/ui';
 * ```
 *
 * Пример в шаблоне:
 * ```html
 * <lib-support-ai-chat-widget (messageSubmit)="onQuestion($event)" />
 * ```
 *
 * Стили: используют CSS-переменные портала (`--primary`, `--bg-card`, …), см. `support-ai-chat-widget.scss`.
 */
import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Вариант вёрстки: плавающий виджет или встроенный блок. */
export type SupportAiChatLayout = 'floating' | 'inline';

@Component({
  selector: 'lib-support-ai-chat-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './support-ai-chat-widget.html',
  styleUrl: './support-ai-chat-widget.scss',
})
export class SupportAiChatWidget implements OnInit {
  /** Класс на `:host` для позиционирования FAB + панели у края экрана. */
  @HostBinding('class.support-ai-chat-widget--floating')
  hostFloating = true;

  /** Класс на `:host` для встроенного блока без фиксированного позиционирования. */
  @HostBinding('class.support-ai-chat-widget--inline')
  hostInline = false;

  private _layout: SupportAiChatLayout = 'floating';

  @Input()
  set layout(value: SupportAiChatLayout) {
    this._layout = value;
    this.syncHostLayout();
  }
  get layout(): SupportAiChatLayout {
    return this._layout;
  }

  /** При `floating`: открыть панель сразу после инициализации (без первого клика по FAB). */
  @Input() defaultOpen = false;

  /** Заголовок панели (например «Техподдержка»). */
  @Input() title = 'Техподдержка';

  /** Подзаголовок под заголовком (статус подключения ИИ, подсказка пользователю). */
  @Input() subtitle = 'ИИ-агент будет подключён позже';

  /** Текст-плейсхолдер в поле ввода. */
  @Input() placeholder = 'Опишите вопрос…';

  /** Подпись на кнопке отправки. */
  @Input() sendLabel = 'Отправить';

  /** Полностью отключает ввод и отправку (например, пока нет сети или сессии). */
  @Input() disabled = false;

  /** Если true — кнопка «Отправить» неактивна при пустом или только пробельном тексте. */
  @Input() requireNonEmpty = true;

  /**
   * Событие после нажатия «Отправить» (или Enter в поле).
   * Полезная нагрузка — текст вопроса; дальше родитель вызывает API/ИИ.
   * После успешной эмиссии поле ввода очищается.
   */
  @Output() readonly messageSubmit = new EventEmitter<string>();

  /**
   * Уведомление об открытии/закрытии панели (актуально для `layout="floating"`).
   * `true` — панель открыта, `false` — закрыта.
   */
  @Output() readonly openChange = new EventEmitter<boolean>();

  /** Текущий черновик сообщения (двусторонняя привязка через `FormsModule`). */
  draft = '';

  /** В режиме floating: видна ли панель (не путать с «есть ли ответ от ИИ»). */
  panelOpen = false;

  get isFloating(): boolean {
    return this.layout === 'floating';
  }

  /** Показывать ли разметку панели: в inline всегда; в floating — только когда `panelOpen`. */
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

  /** Переключение видимости панели по клику на FAB. */
  toggle(): void {
    this.panelOpen = !this.panelOpen;
    this.openChange.emit(this.panelOpen);
  }

  /** Закрытие панели (кнопка «×» в floating-режиме). */
  close(): void {
    if (!this.panelOpen) {
      return;
    }
    this.panelOpen = false;
    this.openChange.emit(false);
  }

  /** Отправка текста родителю и сброс черновика. */
  submit(): void {
    const text = this.draft.trim();
    if (this.requireNonEmpty && !text) {
      return;
    }
    if (this.disabled) {
      return;
    }
    this.messageSubmit.emit(text);
    this.draft = '';
  }

  /** Enter — отправка; Shift+Enter — перенос строки без отправки. */
  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  /** Условие активности кнопки «Отправить». */
  canSend(): boolean {
    if (this.disabled) {
      return false;
    }
    if (!this.requireNonEmpty) {
      return true;
    }
    return this.draft.trim().length > 0;
  }
}

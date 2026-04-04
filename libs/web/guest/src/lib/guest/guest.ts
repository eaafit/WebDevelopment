import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupportAiChatWidget } from '@notary-portal/ui'; // UI-kit техподдержки (`messageSubmit` — текст вопроса)

@Component({
  selector: 'lib-guest',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SupportAiChatWidget],
  templateUrl: './guest.html',
  styleUrl: './guest.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Guest {
  currentYear = new Date().getFullYear();

  /**
   * Обработчик отправки вопроса из `lib-support-ai-chat-widget`.
   * Сюда позже добавить вызов RPC/сервиса с текстом вопроса и отображение ответа ИИ в виджете.
   */
  onSupportDraftSubmit(_text: string): void {
    // Заглушка до подключения API / ИИ-агента
  }
}

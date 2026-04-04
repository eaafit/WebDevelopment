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

  /** Опционально: аналитика / логирование вопроса (ответ уже получен внутри виджета при `useBackendAi`). */
  onSupportDraftSubmit(_text: string): void {}
}

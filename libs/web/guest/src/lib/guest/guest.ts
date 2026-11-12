import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupportAiChatWidget } from '@notary-portal/ui';

@Component({
  selector: 'lib-guest',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SupportAiChatWidget],
  templateUrl: './guest.html',
  styleUrl: './guest.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Guest {
  currentYear = new Date().getFullYear();

  // Хук для аналитики: основной ответ ИИ виджет получает сам через AskSupportAi.
  onSupportDraftSubmit(question: string): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[guest] support question submitted', { length: question.length });
    }
  }
}

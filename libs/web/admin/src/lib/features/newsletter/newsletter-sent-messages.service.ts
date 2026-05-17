import { Injectable } from '@angular/core';
import { buildRpcBaseUrl } from '@notary-portal/ui';

export interface SentMessageView {
  id: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  sentAt: string;
  fromEmail: string;
  toEmail: string;
  transport: string;
  previewUrl: string | null;
}

export interface SentMessagesResponse {
  configured: boolean;
  messages: SentMessageView[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class NewsletterSentMessagesService {
  async listMessages(): Promise<SentMessagesResponse> {
    const response = await fetch(`${buildRpcBaseUrl()}/api/mail/messages`);

    if (!response.ok) {
      return {
        configured: false,
        messages: [],
        error: `Журнал писем вернул статус ${response.status}.`,
      };
    }

    const data = (await response.json()) as Partial<SentMessagesResponse>;

    return {
      configured: Boolean(data.configured),
      messages: Array.isArray(data.messages) ? data.messages : [],
      error: data.error,
    };
  }
}

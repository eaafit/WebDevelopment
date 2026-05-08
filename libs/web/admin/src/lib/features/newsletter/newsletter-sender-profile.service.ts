import { Injectable, inject } from '@angular/core';
import { buildRpcBaseUrl } from '@notary-portal/ui';
import { NewsletterUiStoreService } from './newsletter-ui-store.service';

export interface NewsletterSenderProfile {
  appName: string;
  fromEmail: string;
  host: string;
  port: number | null;
  transport: string;
  configured: boolean;
  source: 'api' | 'mock';
}

@Injectable({ providedIn: 'root' })
export class NewsletterSenderProfileService {
  private readonly uiStore = inject(NewsletterUiStoreService);

  async getSenderProfile(): Promise<NewsletterSenderProfile> {
    try {
      const response = await fetch(`${buildRpcBaseUrl()}/api/mail/sender-profile`);
      if (!response.ok) {
        throw new Error(`Mail sender API returned ${response.status}`);
      }

      const data = (await response.json()) as Partial<NewsletterSenderProfile>;
      return {
        appName: data.appName?.trim() || 'Notary portal',
        fromEmail: data.fromEmail?.trim() || this.fallbackProfile().fromEmail,
        host: data.host?.trim() || this.fallbackProfile().host,
        port: typeof data.port === 'number' ? data.port : this.fallbackProfile().port,
        transport: data.transport?.trim() || 'smtp',
        configured: Boolean(data.configured),
        source: 'api',
      };
    } catch {
      return this.fallbackProfile();
    }
  }

  private fallbackProfile(): NewsletterSenderProfile {
    const profile = this.uiStore.activeSmtpClients()[0];

    return {
      appName: profile?.fromName || 'Notary portal',
      fromEmail: profile?.fromEmail || 'noreply@notary-portal.local',
      host: profile?.host || 'smtp.example.com',
      port: profile?.port ?? 587,
      transport: 'smtp',
      configured: Boolean(profile),
      source: 'mock',
    };
  }
}

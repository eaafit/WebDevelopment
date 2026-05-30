export interface NewsletterMailPayload {
  to: string;
  fullName: string;
  subject: string;
  bodyHtml: string;
}

export interface NewsletterMailer {
  sendNewsletterEmail(payload: NewsletterMailPayload): Promise<void>;
}

export const NEWSLETTER_MAILER = Symbol('NEWSLETTER_MAILER');

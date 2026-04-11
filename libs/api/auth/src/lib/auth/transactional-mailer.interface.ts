export interface WelcomeMailPayload {
  email: string;
  fullName: string;
  roleLabel: string;
  loginUrl: string;
}

/** Письма после регистрации и др. транзакционные уведомления (реализация в apps/api). */
export interface TransactionalMailer {
  sendWelcomeAfterRegistration(payload: WelcomeMailPayload): Promise<void>;
}

export const TRANSACTIONAL_MAILER = Symbol('TRANSACTIONAL_MAILER');

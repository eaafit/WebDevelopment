/**
 * Доставка кода подтверждения контакта. По образцу PasswordResetMailer.
 * Код НИКОГДА не попадает в аудит, в RPC-ответы и на фронт — только сюда.
 */
export interface ContactCodeMailer {
  sendCode(email: string, code: string): Promise<void>;
}

export const CONTACT_CODE_MAILER = Symbol('CONTACT_CODE_MAILER');

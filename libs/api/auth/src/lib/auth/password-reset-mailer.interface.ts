export interface PasswordResetMailer {
  sendResetLink(email: string, resetUrl: string): Promise<void>;
}

export const PASSWORD_RESET_MAILER = Symbol('PASSWORD_RESET_MAILER');

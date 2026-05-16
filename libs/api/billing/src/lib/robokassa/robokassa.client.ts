import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const ROBOKASSA_PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';

export interface RobokassaCreatePaymentParams {
  invoiceId: string;
  amount: string;
  description: string;
  culture?: 'ru' | 'en';
}

export interface RobokassaCreatePaymentResult {
  paymentUrl: string;
  signatureValue: string;
}

export interface RobokassaVerifyResultSignatureParams {
  outSum: string;
  invoiceId: string;
  signatureValue: string;
}

export class RobokassaClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RobokassaClientError';
  }
}

@Injectable()
export class RobokassaClient {
  private readonly merchantLogin = (process.env['ROBOKASSA_MERCHANT_LOGIN'] ?? '').trim();
  private readonly password1 = (process.env['ROBOKASSA_PASSWORD_1'] ?? '').trim();
  private readonly password2 = (process.env['ROBOKASSA_PASSWORD_2'] ?? '').trim();

  private readonly isTestMode = (process.env['ROBOKASSA_TEST_MODE'] ?? 'true').trim() !== 'false';

  createPayment(params: RobokassaCreatePaymentParams): RobokassaCreatePaymentResult {
    this.assertPaymentConfig();

    const outSum = normalizeAmount(params.amount);
    const signatureValue = createHash('md5')
      .update(`${this.merchantLogin}:${outSum}:${params.invoiceId}:${this.password1}`)
      .digest('hex');

    const searchParams = new URLSearchParams({
      MerchantLogin: this.merchantLogin,
      OutSum: outSum,
      InvId: params.invoiceId,
      Description: params.description.slice(0, 100),
      SignatureValue: signatureValue,
      Culture: params.culture ?? 'ru',
    });

    if (this.isTestMode) {
      searchParams.set('IsTest', '1');
    }

    return {
      paymentUrl: `${ROBOKASSA_PAYMENT_URL}?${searchParams.toString()}`,
      signatureValue,
    };
  }

  verifyResultSignature(params: RobokassaVerifyResultSignatureParams): boolean {
    this.assertResultConfig();

    const expected = createHash('md5')
      .update(`${params.outSum}:${params.invoiceId}:${this.password2}`)
      .digest('hex');
    const actual = params.signatureValue.trim().toLowerCase();

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    return (
      expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private assertPaymentConfig(): void {
    if (!this.merchantLogin || !this.password1) {
      throw new RobokassaClientError(
        'Robokassa is not configured: set ROBOKASSA_MERCHANT_LOGIN and ROBOKASSA_PASSWORD_1',
      );
    }
  }

  private assertResultConfig(): void {
    if (!this.password2) {
      throw new RobokassaClientError(
        'Robokassa result validation is not configured: set ROBOKASSA_PASSWORD_2',
      );
    }
  }
}

function normalizeAmount(value: string): string {
  const normalized = value.trim();
  const amount = Number(normalized);

  if (!normalized || Number.isNaN(amount) || amount <= 0) {
    throw new RobokassaClientError('Robokassa amount must be a positive number');
  }

  return amount.toFixed(2);
}

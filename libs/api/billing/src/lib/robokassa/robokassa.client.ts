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

interface RobokassaConfig {
  merchantLogin: string;
  password1: string;
  password2: string;
  isTestMode: boolean;
}

@Injectable()
export class RobokassaClient {
  createPayment(params: RobokassaCreatePaymentParams): RobokassaCreatePaymentResult {
    const config = readRobokassaConfig();
    this.assertPaymentConfig(config);

    const outSum = normalizeAmount(params.amount);
    const signatureValue = createHash('md5')
      .update(`${config.merchantLogin}:${outSum}:${params.invoiceId}:${config.password1}`)
      .digest('hex');

    const searchParams = new URLSearchParams({
      MerchantLogin: config.merchantLogin,
      OutSum: outSum,
      InvId: params.invoiceId,
      Description: normalizeDescription(params.description),
      SignatureValue: signatureValue,
      Culture: params.culture ?? 'ru',
    });

    if (config.isTestMode) {
      searchParams.set('IsTest', '1');
    }

    return {
      paymentUrl: `${ROBOKASSA_PAYMENT_URL}?${searchParams.toString()}`,
      signatureValue,
    };
  }

  verifyResultSignature(params: RobokassaVerifyResultSignatureParams): boolean {
    const config = readRobokassaConfig();
    this.assertResultConfig(config);

    const expected = createHash('md5')
      .update(`${params.outSum}:${params.invoiceId}:${config.password2}`)
      .digest('hex');
    const actual = params.signatureValue.trim().toLowerCase();

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    return (
      expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private assertPaymentConfig(config: RobokassaConfig): void {
    if (!config.merchantLogin || !config.password1) {
      throw new RobokassaClientError(
        'Robokassa is not configured: set ROBOKASSA_MERCHANT_LOGIN and ROBOKASSA_PASSWORD_1',
      );
    }
  }

  private assertResultConfig(config: RobokassaConfig): void {
    if (!config.password2) {
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

function readRobokassaConfig(): RobokassaConfig {
  return {
    merchantLogin: (process.env['ROBOKASSA_MERCHANT_LOGIN'] ?? '').trim(),
    password1: (process.env['ROBOKASSA_PASSWORD_1'] ?? '').trim(),
    password2: (process.env['ROBOKASSA_PASSWORD_2'] ?? '').trim(),
    isTestMode: parseTestMode(process.env['ROBOKASSA_TEST_MODE']),
  };
}

function parseTestMode(value: string | undefined): boolean {
  const normalized = (value ?? 'true').trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0';
}

function normalizeDescription(value: string): string {
  const normalized = value.trim();
  return (normalized || 'Payment').slice(0, 100);
}

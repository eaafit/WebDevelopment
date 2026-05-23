import { createHash } from 'node:crypto';
import { RobokassaClient } from './robokassa.client';

describe('RobokassaClient', () => {
  const originalMerchantLogin = process.env['ROBOKASSA_MERCHANT_LOGIN'];
  const originalPassword1 = process.env['ROBOKASSA_PASSWORD_1'];
  const originalPassword2 = process.env['ROBOKASSA_PASSWORD_2'];
  const originalTestMode = process.env['ROBOKASSA_TEST_MODE'];

  beforeEach(() => {
    process.env['ROBOKASSA_MERCHANT_LOGIN'] = 'Test1999';
    process.env['ROBOKASSA_PASSWORD_1'] = 'password_1';
    process.env['ROBOKASSA_PASSWORD_2'] = 'password_2';
    process.env['ROBOKASSA_TEST_MODE'] = 'true';
  });

  afterAll(() => {
    process.env['ROBOKASSA_MERCHANT_LOGIN'] = originalMerchantLogin;
    process.env['ROBOKASSA_PASSWORD_1'] = originalPassword1;
    process.env['ROBOKASSA_PASSWORD_2'] = originalPassword2;
    process.env['ROBOKASSA_TEST_MODE'] = originalTestMode;
  });

  it('should create a signed test-mode payment URL', () => {
    const client = new RobokassaClient();

    const result = client.createPayment({
      invoiceId: 'payment-1',
      amount: '1350',
      description: 'Subscription payment',
    });

    const signature = createHash('md5')
      .update('Test1999:1350.00:payment-1:password_1')
      .digest('hex');

    expect(result.signatureValue).toBe(signature);
    expect(result.paymentUrl).toContain('MerchantLogin=Test1999');
    expect(result.paymentUrl).toContain('OutSum=1350.00');
    expect(result.paymentUrl).toContain('InvId=payment-1');
    expect(result.paymentUrl).toContain(`SignatureValue=${signature}`);
    expect(result.paymentUrl).toContain('IsTest=1');
  });

  it('should read environment changes at call time', () => {
    const client = new RobokassaClient();
    process.env['ROBOKASSA_MERCHANT_LOGIN'] = 'AnotherMerchant';
    process.env['ROBOKASSA_PASSWORD_1'] = 'another_password';

    const result = client.createPayment({
      invoiceId: 'payment-2',
      amount: '10.00',
      description: 'Payment',
    });

    const signature = createHash('md5')
      .update('AnotherMerchant:10.00:payment-2:another_password')
      .digest('hex');

    expect(result.paymentUrl).toContain('MerchantLogin=AnotherMerchant');
    expect(result.signatureValue).toBe(signature);
  });

  it('should omit test flag when test mode is disabled', () => {
    process.env['ROBOKASSA_TEST_MODE'] = 'false';
    const client = new RobokassaClient();

    const result = client.createPayment({
      invoiceId: 'payment-3',
      amount: '10.00',
      description: 'Payment',
    });

    expect(result.paymentUrl).not.toContain('IsTest=1');
  });
});

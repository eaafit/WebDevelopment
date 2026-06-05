import { MOCK_PAYMENTS, type Payment } from './payments.shared';
import {
  PAYMENT_CSV_COLUMNS,
  buildPaymentCsvContent,
  buildPaymentCsvFileName,
} from './payment-csv-export';

describe('payment csv export', () => {
  it('uses stable payment columns in the expected review order', () => {
    expect(PAYMENT_CSV_COLUMNS.map((column) => column.key)).toEqual([
      'id',
      'paymentDate',
      'payer',
      'type',
      'amount',
      'fee',
      'paymentMethod',
      'transactionId',
      'attachment',
      'application',
      'status',
    ]);
  });

  it('builds Excel-friendly CSV content with BOM by default', () => {
    const content = buildPaymentCsvContent([MOCK_PAYMENTS[0]]);

    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content).toContain('"ID";"Дата платежа";"Плательщик"');
    expect(content).toContain('txn_abc123');
    expect(content).toContain('RUB');
  });

  it('can omit BOM for in-memory comparisons and service tests', () => {
    const content = buildPaymentCsvContent([MOCK_PAYMENTS[0]], { includeBom: false });

    expect(content.charCodeAt(0)).not.toBe(0xfeff);
    expect(content.startsWith('"ID";')).toBe(true);
  });

  it('escapes quotes and keeps semicolons inside a single CSV cell', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      payer: 'ООО "Север;Юг"',
      transactionId: 'txn;42',
    };

    const content = buildPaymentCsvContent([payment], { includeBom: false });

    expect(content).toContain('"ООО ""Север;Юг"""');
    expect(content).toContain('"txn;42"');
  });

  it('falls back to dashes for optional receipt and relation fields', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      transactionId: undefined,
      attachmentFileName: undefined,
      attachmentFileUrl: undefined,
      assessmentId: undefined,
      subscriptionId: undefined,
    };

    const content = buildPaymentCsvContent([payment], { includeBom: false });

    expect(content).toContain('"\u2014";"\u2014";"\u2014"');
  });

  it('keeps receipt file name when storage url is missing', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      attachmentFileName: 'receipt-offline.html',
      attachmentFileUrl: undefined,
    };

    const content = buildPaymentCsvContent([payment], { includeBom: false });

    expect(content).toContain('"receipt-offline.html"');
  });

  it('uses subscription id in relation column when assessment id is absent', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      assessmentId: undefined,
      subscriptionId: 'subscription-42',
    };

    const content = buildPaymentCsvContent([payment], { includeBom: false });

    expect(content).toContain('"subscription-42"');
  });

  it('builds deterministic file names from a supplied date', () => {
    const fileName = buildPaymentCsvFileName(new Date('2026-06-05T13:40:12.000Z'));

    expect(fileName).toBe('payments-2026-06-05T13-40-12.csv');
  });
});

import { MOCK_PAYMENTS, type Payment } from './payments.shared';
import {
  PAYMENT_EMPTY_VALUE,
  buildPaymentExportSummary,
  buildPaymentRowAriaLabel,
  formatPaymentDateTime,
  formatPaymentFee,
  formatPaymentMoney,
  getPaymentReceiptSummary,
  getPaymentRelationSummary,
  getPaymentRiskTone,
  getPaymentSearchTokens,
  getPaymentStatusLabel,
  getPaymentTypeLabel,
  paymentMatchesSearch,
  shortenPaymentId,
} from './payment-display';

describe('payment display helpers', () => {
  it('formats money and fees with stable Russian locale defaults', () => {
    expect(formatPaymentMoney(12500, 'RUB')).toContain('12');
    expect(formatPaymentMoney(12500, 'RUB')).toContain('RUB');
    expect(formatPaymentMoney(undefined, '')).toContain('0');
    expect(formatPaymentFee(undefined)).toContain('0');
  });

  it('formats valid dates and preserves invalid backend values for diagnostics', () => {
    expect(formatPaymentDateTime('2026-03-06T08:45:00.000Z')).toContain('2026');
    expect(formatPaymentDateTime('not-a-date')).toBe('not-a-date');
    expect(formatPaymentDateTime(undefined)).toBe(PAYMENT_EMPTY_VALUE);
  });

  it('returns shared labels for type and status', () => {
    const payment = MOCK_PAYMENTS[0];

    expect(getPaymentTypeLabel(payment)).toBeTruthy();
    expect(getPaymentStatusLabel(payment)).toBeTruthy();
  });

  it('prefers assessment relation over subscription relation', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      assessmentId: 'assessment-1234567890',
      subscriptionId: 'subscription-should-not-win',
    };

    expect(getPaymentRelationSummary(payment)).toEqual(
      expect.objectContaining({
        kind: 'assessment',
        id: 'assessment-1234567890',
        csvValue: 'assessment-1234567890',
      }),
    );
  });

  it('falls back to subscription relation when assessment is absent', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      assessmentId: null,
      subscriptionId: 'subscription-1234567890',
    };

    expect(getPaymentRelationSummary(payment)).toEqual(
      expect.objectContaining({
        kind: 'subscription',
        id: 'subscription-1234567890',
        csvValue: 'subscription-1234567890',
      }),
    );
  });

  it('returns an explicit empty relation instead of leaking null values', () => {
    const payment: Payment = {
      ...MOCK_PAYMENTS[0],
      assessmentId: undefined,
      subscriptionId: undefined,
    };

    expect(getPaymentRelationSummary(payment)).toEqual(
      expect.objectContaining({
        kind: 'none',
        id: null,
        csvValue: PAYMENT_EMPTY_VALUE,
      }),
    );
  });

  it('marks receipt as available only when file name and file url are present', () => {
    expect(getPaymentReceiptSummary(MOCK_PAYMENTS[0])).toEqual(
      expect.objectContaining({
        state: 'available',
        canOpen: true,
        canDownload: true,
      }),
    );

    expect(
      getPaymentReceiptSummary({
        ...MOCK_PAYMENTS[0],
        attachmentFileUrl: undefined,
      }),
    ).toEqual(
      expect.objectContaining({
        state: 'missing-url',
        canOpen: false,
        canDownload: false,
      }),
    );

    expect(
      getPaymentReceiptSummary({
        ...MOCK_PAYMENTS[0],
        attachmentFileName: undefined,
      }),
    ).toEqual(
      expect.objectContaining({
        state: 'missing-file',
        canOpen: false,
        canDownload: false,
      }),
    );
  });

  it('builds searchable tokens from payment ids, payer names, relations, receipt and status', () => {
    const tokens = getPaymentSearchTokens(MOCK_PAYMENTS[0], 'Applicant One');

    expect(tokens).toContain('payment-1');
    expect(tokens).toContain('applicant');
    expect(tokens).toContain('one');
    expect(tokens).toContain('txn_abc123');
    expect(tokens).toContain('assessment-1');
    expect(tokens).toContain('check_1001.pdf');
  });

  it('matches user search across normalized payment snapshots', () => {
    expect(paymentMatchesSearch(MOCK_PAYMENTS[0], ' applicant ', 'Applicant One')).toBe(true);
    expect(paymentMatchesSearch(MOCK_PAYMENTS[0], 'TXN_ABC123')).toBe(true);
    expect(paymentMatchesSearch(MOCK_PAYMENTS[0], 'missing-value')).toBe(false);
    expect(paymentMatchesSearch(MOCK_PAYMENTS[0], '')).toBe(true);
  });

  it('maps payment status into conservative risk tones', () => {
    expect(getPaymentRiskTone({ ...MOCK_PAYMENTS[0], status: 'completed' })).toBe('success');
    expect(getPaymentRiskTone({ ...MOCK_PAYMENTS[0], status: 'failed' })).toBe('danger');
    expect(getPaymentRiskTone({ ...MOCK_PAYMENTS[0], status: 'refunded' })).toBe('danger');
    expect(getPaymentRiskTone({ ...MOCK_PAYMENTS[0], status: 'pending', transactionId: 'txn' })).toBe(
      'warning',
    );
    expect(getPaymentRiskTone({ ...MOCK_PAYMENTS[0], status: 'pending', transactionId: undefined })).toBe(
      'neutral',
    );
  });

  it('builds readable row labels for icon-only table actions', () => {
    const label = buildPaymentRowAriaLabel(MOCK_PAYMENTS[0], 'Applicant One');

    expect(label).toContain('payment payment-1');
    expect(label).toContain('Applicant One');
    expect(label).toContain('receipt check_1001.pdf');
  });

  it('builds export summaries with row counts and status counters', () => {
    const summary = buildPaymentExportSummary(MOCK_PAYMENTS);

    expect(summary).toContain('rows=2');
    expect(summary).toContain('completed=1');
    expect(summary).toContain('pending=1');
    expect(summary).toContain('failed=0');
  });

  it('shortens long ids while preserving short ids', () => {
    expect(shortenPaymentId('short-id')).toBe('short-id');
    expect(shortenPaymentId('1234567890abcdefghijklmnop')).toBe('12345678...ijklmnop');
    expect(shortenPaymentId(null)).toBe(PAYMENT_EMPTY_VALUE);
  });
});

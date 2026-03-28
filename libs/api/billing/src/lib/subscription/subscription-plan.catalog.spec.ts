import { addSubscriptionMonths } from './subscription-plan.catalog';

describe('addSubscriptionMonths', () => {
  it('preserves the same day when it exists in the next month', () => {
    expect(addSubscriptionMonths(new Date('2026-03-28T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-04-28T00:00:00.000Z',
    );
  });

  it('clamps to the last day of the next month when the same day does not exist', () => {
    expect(addSubscriptionMonths(new Date('2026-01-30T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('uses leap day when the target month includes it', () => {
    expect(addSubscriptionMonths(new Date('2028-01-30T00:00:00.000Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });
});

import { addCalendarMonths, normalizeDate } from './subscription-date.util';

describe('subscription-date.util', () => {
  it('normalizes dates to UTC midnight', () => {
    expect(normalizeDate(new Date('2026-03-28T15:42:00.000Z')).toISOString()).toBe(
      '2026-03-28T00:00:00.000Z',
    );
  });

  it('preserves the same day when it exists in the next month', () => {
    expect(addCalendarMonths(new Date('2026-03-28T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-04-28T00:00:00.000Z',
    );
  });

  it('clamps to the last day of the next month when the same day does not exist', () => {
    expect(addCalendarMonths(new Date('2026-01-30T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});

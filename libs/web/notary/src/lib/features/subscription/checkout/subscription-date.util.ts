export function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addCalendarMonths(startDate: Date, months: number): Date {
  const targetMonthStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(startDate.getUTCDate(), lastDayOfTargetMonth),
    ),
  );
}

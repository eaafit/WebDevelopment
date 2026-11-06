export interface AssessmentResultModel {
  id: string;
  address: string;
  objectTypeLabel: string;
  area: string;
  /** Итоговая стоимость в рублях; null, если оценщик ещё не указал сумму. */
  finalEstimatedValue: number | null;
  assessedAt: string | null;
}

/** Отчёт об оценке в виде, удобном для UI (собирается из ReportService.listReports). */
export interface AssessmentReport {
  id: string;
  assessmentId: string;
  title: string;
  status: 'Draft' | 'Signed';
  createdAt: string;
  fileUrl: string | null;
  signedAt: string | null;
}

export interface CalculationBreakdownRow {
  label: string;
  value: number;
  hint?: string;
}

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function formatRub(value: number | null): string {
  return value === null ? 'Не указана' : rubFormatter.format(value);
}

export function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

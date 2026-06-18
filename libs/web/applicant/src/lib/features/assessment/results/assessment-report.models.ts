export const DEMO_SIGNED_REPORT_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

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
  value: string;
  isTotal?: boolean;
}

export function getMockCalculationBreakdown(finalValue: number): CalculationBreakdownRow[] {
  const marketValue = Math.round(finalValue * 1.05);
  const adjustments = marketValue - finalValue;
  const areaFactor = Math.round(finalValue * 0.35);
  const conditionFactor = Math.round(finalValue * 0.12);
  const floorFactor = -Math.round(finalValue * 0.03);
  const locationFactor = Math.round(finalValue * 0.08);

  return [
    { label: 'Рыночная стоимость', value: formatRubles(marketValue) },
    { label: 'Площадь', value: formatRubles(areaFactor) },
    { label: 'Состояние', value: formatRubles(conditionFactor) },
    { label: 'Этаж / этажность', value: formatRubles(floorFactor) },
    { label: 'Расположение', value: formatRubles(locationFactor) },
    { label: 'Корректировки (итого)', value: formatRubles(-adjustments) },
    { label: 'Итоговая стоимость', value: formatRubles(finalValue), isTotal: true },
  ];
}

export function formatRubles(value: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
}

export function parseEstimatedValue(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

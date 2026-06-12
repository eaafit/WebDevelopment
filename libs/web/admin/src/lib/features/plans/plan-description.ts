const FEATURES_MARKER = '\u0424\u0443\u043d\u043a\u0446\u0438\u0438:';

export interface PlanDescriptionParts {
  description: string;
  features: string[];
}

export function splitPlanDescription(rawDescription: string | null | undefined): PlanDescriptionParts {
  const normalized = (rawDescription ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { description: '', features: [] };
  }

  const featuresMarkerIndex = normalized.indexOf(FEATURES_MARKER);
  const legacyMarkerIndex = normalized.indexOf('Features:');
  const markerIndex =
    featuresMarkerIndex >= 0
      ? featuresMarkerIndex
      : legacyMarkerIndex >= 0
        ? legacyMarkerIndex
        : -1;

  if (markerIndex < 0) {
    return {
      description: normalized,
      features: [],
    };
  }

  const description = normalized.slice(0, markerIndex).trim();
  const featuresBlock = normalized
    .slice(markerIndex)
    .replace(FEATURES_MARKER, '')
    .replace('Features:', '')
    .trim();

  const features = featuresBlock
    .split('\n')
    .map((line) => line.replace(/^[-\u2022*\s]+/, '').trim())
    .filter((line) => line.length > 0);

  return { description, features };
}

export function buildPlanDescription(description: string, featuresText: string): string {
  const normalizedDescription = description.trim();
  const normalizedFeatures = featuresText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-\u2022*\s]+/, '').trim())
    .filter((line) => line.length > 0);

  if (normalizedFeatures.length === 0) {
    return normalizedDescription;
  }

  const featuresSection = `${FEATURES_MARKER}\n${normalizedFeatures.join('\n')}`;
  return normalizedDescription ? `${normalizedDescription}\n\n${featuresSection}` : featuresSection;
}

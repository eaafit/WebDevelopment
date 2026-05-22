export abstract class BitrixApiError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BitrixAuthError extends BitrixApiError {
  readonly code = 'BITRIX_AUTH_ERROR';
}

export class BitrixRateLimitError extends BitrixApiError {
  readonly code = 'BITRIX_RATE_LIMIT';
}

export class BitrixUnavailableError extends BitrixApiError {
  readonly code = 'BITRIX_UNAVAILABLE';
}

export class BitrixValidationError extends BitrixApiError {
  readonly code = 'BITRIX_VALIDATION';
}

export class BitrixUnknownError extends BitrixApiError {
  readonly code = 'BITRIX_UNKNOWN';
}

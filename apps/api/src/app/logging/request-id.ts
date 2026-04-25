import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const RESPONSE_REQUEST_ID_HEADER = 'X-Request-Id';

export type RequestHeaders = Record<string, string | string[] | undefined>;

export const MAX_REQUEST_ID_LENGTH = 128;

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const TRACEPARENT_PATTERN = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i;
const ZERO_TRACE_ID = '00000000000000000000000000000000';

export function resolveRequestIdFromHeaders(
  headers: RequestHeaders,
  generateId: () => string = randomUUID,
): string {
  const requestId = normalizeIncomingRequestId(firstHeaderValue(headers[REQUEST_ID_HEADER]));
  if (requestId) {
    return requestId;
  }

  const traceId = extractTraceIdFromTraceparent(firstHeaderValue(headers['traceparent']));
  if (traceId) {
    return traceId;
  }

  return generateId();
}

export function normalizeIncomingRequestId(value: string | undefined): string | null {
  const requestId = value?.trim();
  if (!requestId) {
    return null;
  }

  if (requestId.length > MAX_REQUEST_ID_LENGTH) {
    return null;
  }

  return SAFE_REQUEST_ID_PATTERN.test(requestId) ? requestId : null;
}

export function extractTraceIdFromTraceparent(traceparent: string | undefined): string | null {
  if (!traceparent) {
    return null;
  }

  const match = TRACEPARENT_PATTERN.exec(traceparent.trim());
  const traceId = match?.[1];
  if (!traceId || traceId.toLowerCase() === ZERO_TRACE_ID) {
    return null;
  }

  return traceId.toLowerCase();
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const trimmed = firstValue?.trim();
  return trimmed ? trimmed : undefined;
}

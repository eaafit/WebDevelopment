import { ConnectError } from '@connectrpc/connect';
import { HttpException } from '@nestjs/common';
import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  context,
  trace,
  type AttributeValue,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
import { NotarySpanAttributes } from './business-operations';

const DEFAULT_TRACER_NAME = 'notary.backend.business';
const SAFE_ERROR_MESSAGE_LIMIT = 120;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'text/html',
  'text/plain',
]);
const UUID_VALUE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_VALUE_PATTERN = /^\+?[\d\s().-]{7,}$/;
const failedSpans = new WeakSet<Span>();

const BLOCKED_EXACT_KEYS = new Set([
  'address',
  'body',
  'email',
  'file_name',
  'filename',
  'fio',
  'full_name',
  'fullname',
  'object_key',
  'objectkey',
  'password',
  'phone',
  'phone_number',
  'raw',
  'secret',
  'token',
]);

export type BusinessSpanAttributeValue = AttributeValue | null | undefined;
export type BusinessSpanAttributes = Record<string, BusinessSpanAttributeValue>;

export interface RunInSpanOptions {
  tracerName?: string;
  kind?: SpanKind;
  root?: boolean;
  spanOptions?: Omit<SpanOptions, 'attributes' | 'kind'>;
}

export async function runInSpan<T>(
  spanName: string,
  attributes: BusinessSpanAttributes,
  action: (span: Span) => T | Promise<T>,
  options: RunInSpanOptions = {},
): Promise<T> {
  const tracer = trace.getTracer(options.tracerName ?? DEFAULT_TRACER_NAME);
  const parentContext = options.root ? ROOT_CONTEXT : context.active();
  const span = tracer.startSpan(
    spanName,
    {
      ...options.spanOptions,
      ...(options.kind !== undefined ? { kind: options.kind } : {}),
      attributes: sanitizeSpanAttributes(attributes),
    },
    parentContext,
  );

  return context.with(trace.setSpan(parentContext, span), async () => {
    try {
      const result = await action(span);
      if (!failedSpans.has(span)) {
        span.setAttribute(NotarySpanAttributes.result, 'success');
      }
      return result;
    } catch (error) {
      markSpanFailure(span, error);
      throw error;
    } finally {
      failedSpans.delete(span);
      span.end();
    }
  });
}

export function setSpanAttributes(span: Span, attributes: BusinessSpanAttributes): void {
  const sanitized = sanitizeSpanAttributes(attributes);
  for (const [key, value] of Object.entries(sanitized)) {
    span.setAttribute(key, value);
  }
}

export function sanitizeSpanAttributes(
  attributes: BusinessSpanAttributes,
): Record<string, AttributeValue> {
  const sanitized: Record<string, AttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (isBlockedAttributeKey(key) || isEmptyAttributeValue(value)) {
      continue;
    }

    if (key === NotarySpanAttributes.actorRole) {
      const role = normalizeSpanActorRole(value);
      if (role) {
        sanitized[key] = role;
      }
      continue;
    }

    if (key === 'document.content_type') {
      sanitized[key] = normalizeSpanContentType(value);
      continue;
    }

    if (key === 'document.size_bytes') {
      continue;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (isBlockedStringValue(normalized)) {
        continue;
      }
      sanitized[key] = normalized;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function recordSpanFailure(span: Span, error: unknown): void {
  const safeMessage = spanErrorStatusMessage(error);

  span.recordException(safeMessage);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: safeMessage,
  });
}

export function markSpanFailure(span: Span, error: unknown): void {
  recordSpanFailure(span, error);
  span.setAttribute(NotarySpanAttributes.result, 'error');
  failedSpans.add(span);
}

export function spanErrorStatusMessage(error: unknown): string {
  if (error instanceof ConnectError) {
    return `ConnectError:${error.code}`;
  }

  if (error instanceof HttpException) {
    return `HttpException:${error.getStatus()}`;
  }

  if (error instanceof Error && error.name.trim()) {
    return error.name.slice(0, SAFE_ERROR_MESSAGE_LIMIT);
  }

  return 'UnknownError';
}

export function normalizeSpanActorRole(role: unknown): string | undefined {
  if (role === undefined || role === null) {
    return undefined;
  }

  const normalized =
    typeof role === 'number'
      ? String(role)
      : String(role)
          .trim()
          .replace(/^USER_ROLE_/i, '')
          .replace(/[^a-z0-9]+/gi, '_')
          .replace(/^_+|_+$/g, '')
          .toLowerCase();

  switch (normalized) {
    case '1':
    case 'applicant':
      return 'applicant';
    case '2':
    case 'notary':
      return 'notary';
    case '3':
    case 'admin':
      return 'admin';
    case 'system':
      return 'system';
    case 'anonymous':
      return 'anonymous';
    default:
      return undefined;
  }
}

export function normalizeSpanContentType(value: unknown): string {
  if (value === undefined || value === null) {
    return 'unknown';
  }

  const normalized = String(value).split(';')[0]?.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  return ALLOWED_CONTENT_TYPES.has(normalized) ? normalized : 'unsupported';
}

export function spanSizeBucket(value: unknown): string {
  const size =
    typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : Number.NaN;

  if (!Number.isFinite(size) || size < 0) {
    return 'unknown';
  }

  if (size === 0) {
    return 'zero';
  }

  if (size <= 1024) {
    return 'lt_1kb';
  }

  if (size <= 100 * 1024) {
    return '1kb_100kb';
  }

  if (size <= 1024 * 1024) {
    return '100kb_1mb';
  }

  if (size <= 10 * 1024 * 1024) {
    return '1mb_10mb';
  }

  return 'gt_10mb';
}

export { SpanKind };

function isEmptyAttributeValue(value: BusinessSpanAttributeValue): value is null | undefined | '' {
  return value === undefined || value === null || value === '';
}

function isBlockedAttributeKey(key: string): boolean {
  const normalized = normalizeAttributeKey(key);
  const compact = normalized.replace(/_/g, '');
  const tokens = normalized.split('_').filter(Boolean);
  const lastToken = tokens.at(-1);

  if (lastToken === 'id' || lastToken === 'uuid' || lastToken === 'guid') {
    return true;
  }

  if (BLOCKED_EXACT_KEYS.has(normalized) || BLOCKED_EXACT_KEYS.has(compact)) {
    return true;
  }

  if (
    (tokens.includes('email') && !isPresenceFlag(tokens, 'email')) ||
    (tokens.includes('phone') && !isPresenceFlag(tokens, 'phone')) ||
    tokens.includes('address') ||
    tokens.includes('password') ||
    tokens.includes('secret') ||
    tokens.includes('token') ||
    tokens.includes('fio')
  ) {
    return true;
  }

  if (
    (tokens.includes('full') && tokens.includes('name')) ||
    (tokens.includes('phone') && tokens.includes('number')) ||
    (tokens.includes('object') && tokens.includes('key')) ||
    (tokens.includes('file') && tokens.includes('name'))
  ) {
    return true;
  }

  if ((tokens.includes('request') || tokens.includes('response')) && tokens.includes('body')) {
    return true;
  }

  if (tokens.includes('raw') && (tokens.includes('body') || tokens.includes('address'))) {
    return true;
  }

  return false;
}

function isBlockedStringValue(value: string): boolean {
  if (!value) {
    return true;
  }

  if (UUID_VALUE_PATTERN.test(value) || EMAIL_VALUE_PATTERN.test(value)) {
    return true;
  }

  if (PHONE_VALUE_PATTERN.test(value) && value.replace(/\D/g, '').length >= 7) {
    return true;
  }

  return false;
}

function normalizeAttributeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isPresenceFlag(tokens: string[], sensitiveToken: 'email' | 'phone'): boolean {
  const tokenIndex = tokens.indexOf(sensitiveToken);
  return tokenIndex > 0 && tokens[tokenIndex - 1] === 'has';
}

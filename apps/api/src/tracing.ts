import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { IncomingMessage } from 'http';

const DEFAULT_SERVICE_NAME = 'notary-api';
const DEFAULT_SAFE_HTTP_HOST = 'notary-api';
const DEFAULT_OTLP_HTTP_ENDPOINT = 'http://localhost:4318';
const OTLP_TRACES_PATH = '/v1/traces';
const DYNAMIC_PATH_SEGMENT_PATTERN =
  /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{16,}|[A-Za-z0-9_-]{24,}|\d{6,})(?=\/|$)/gi;
const REDACTED_QUERY_PARAMS = [
  'access_token',
  'code',
  'password',
  'refresh_token',
  'secret',
  'sig',
  'signature',
  'Signature',
  'token',
];

type TracesExporterMode = 'otlp' | 'none';
type SpanAttributeWriter = Pick<Span, 'setAttribute'>;
type ExpressLikeRequest = IncomingMessage & {
  baseUrl?: string;
  route?: {
    path?: string | RegExp | Array<string | RegExp>;
  };
};

const tracesExporter = resolveTracesExporter(process.env['OTEL_TRACES_EXPORTER']);

if (tracesExporter === 'otlp') {
  startTracing();
}

function startTracing(): void {
  const serviceName = normalizeEnvValue(process.env['OTEL_SERVICE_NAME']) ?? DEFAULT_SERVICE_NAME;
  const tracesEndpoint = resolveOtlpTracesEndpoint(process.env);

  try {
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
      }),
      traceExporter: new OTLPTraceExporter({
        url: tracesEndpoint,
      }),
      instrumentations: [getNodeAutoInstrumentations(buildNodeAutoInstrumentationConfig())],
    });

    sdk.start();
    registerShutdownHook(sdk);
  } catch (error) {
    console.warn(`OpenTelemetry tracing was not started: ${safeErrorMessage(error)}`);
  }
}

export function buildNodeAutoInstrumentationConfig(): NonNullable<
  Parameters<typeof getNodeAutoInstrumentations>[0]
> {
  return {
    '@opentelemetry/instrumentation-aws-sdk': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-pino': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-http': {
      disableOutgoingRequestInstrumentation: true,
      redactedQueryParams: REDACTED_QUERY_PARAMS,
      applyCustomAttributesOnSpan: (span, request) => {
        if (request instanceof IncomingMessage) {
          applySafeIncomingHttpAttributes(span, request);
        }
      },
    },
  };
}

function registerShutdownHook(sdk: NodeSDK): void {
  const shutdown = () => {
    sdk.shutdown().catch((error: unknown) => {
      console.warn(`OpenTelemetry tracing shutdown failed: ${safeErrorMessage(error)}`);
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

function resolveTracesExporter(value: string | undefined): TracesExporterMode {
  const configuredValue = normalizeEnvValue(value)?.toLowerCase();

  if (!configuredValue || configuredValue === 'none' || configuredValue === 'off') {
    return 'none';
  }

  if (configuredValue === 'otlp') {
    return 'otlp';
  }

  console.warn(
    `Unsupported OTEL_TRACES_EXPORTER="${configuredValue}", tracing is disabled. Use "otlp" or "none".`,
  );
  return 'none';
}

function resolveOtlpTracesEndpoint(env: NodeJS.ProcessEnv): string {
  const explicitTracesEndpoint = normalizeEnvValue(env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT']);
  if (explicitTracesEndpoint) {
    return appendTracesPath(explicitTracesEndpoint);
  }

  const baseEndpoint =
    normalizeEnvValue(env['OTEL_EXPORTER_OTLP_ENDPOINT']) ?? DEFAULT_OTLP_HTTP_ENDPOINT;
  return appendTracesPath(baseEndpoint);
}

function appendTracesPath(endpoint: string): string {
  const normalizedEndpoint = endpoint.replace(/\/+$/, '');

  if (normalizedEndpoint.endsWith(OTLP_TRACES_PATH)) {
    return normalizedEndpoint;
  }

  if (normalizedEndpoint.endsWith('/v1')) {
    return `${normalizedEndpoint}/traces`;
  }

  return `${normalizedEndpoint}${OTLP_TRACES_PATH}`;
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function applySafeIncomingHttpAttributes(
  span: SpanAttributeWriter,
  request: IncomingMessage,
): void {
  const safePath = resolveSafeHttpPath(request);
  const safeUrl = `${resolveRequestScheme(request)}://${resolveRequestHost()}${safePath}`;

  span.setAttribute('http.target', safePath);
  span.setAttribute('http.url', safeUrl);
  span.setAttribute('url.full', safeUrl);
  span.setAttribute('url.path', safePath);

  if (request.url?.includes('?')) {
    span.setAttribute('url.query', '[REDACTED]');
  }
}

export function resolveSafeHttpPath(request: IncomingMessage): string {
  const routePath = resolveExpressRoutePath(request);
  if (routePath) {
    return routePath;
  }

  return normalizeDynamicPathSegments(resolveRequestPath(request.url));
}

function resolveExpressRoutePath(request: IncomingMessage): string | undefined {
  const expressRequest = request as ExpressLikeRequest;
  const routePath = expressRequest.route?.path;
  if (typeof routePath !== 'string') {
    return undefined;
  }

  return normalizeHttpPath(`${expressRequest.baseUrl ?? ''}${routePath}`);
}

function resolveRequestPath(url: string | undefined): string {
  if (!url) {
    return '/';
  }

  try {
    return normalizeHttpPath(new URL(url, 'http://localhost').pathname);
  } catch {
    return normalizeHttpPath(url.split('?')[0] ?? '/');
  }
}

function normalizeDynamicPathSegments(path: string): string {
  return path.replace(DYNAMIC_PATH_SEGMENT_PATTERN, '/:id');
}

function normalizeHttpPath(path: string): string {
  const normalized = path.trim();
  if (!normalized) {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function resolveRequestHost(): string {
  return normalizeSafeHost(process.env['OTEL_HTTP_SPAN_HOST']) ?? DEFAULT_SAFE_HTTP_HOST;
}

function resolveRequestScheme(request: IncomingMessage): string {
  const forwardedProto = headerValue(request.headers['x-forwarded-proto'])
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();

  return forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : 'http';
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim())?.trim();
  }

  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSafeHost(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized.length > 253) {
    return undefined;
  }

  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}

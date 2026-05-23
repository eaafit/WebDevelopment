import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const DEFAULT_SERVICE_NAME = 'notary-api';
const DEFAULT_OTLP_HTTP_ENDPOINT = 'http://localhost:4318';
const OTLP_TRACES_PATH = '/v1/traces';

type TracesExporterMode = 'otlp' | 'none';

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
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-pino': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();
    registerShutdownHook(sdk);
  } catch (error) {
    console.warn(`OpenTelemetry tracing was not started: ${safeErrorMessage(error)}`);
  }
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

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

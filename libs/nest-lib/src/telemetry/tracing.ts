import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { TelemetryOptions } from './interfaces/telemetry-options.interface';

let activeSdk: NodeSDK | null = null;
let shutdownHooksRegistered = false;

function normalizePathPrefix(prefix: string): string {
  const trimmed = prefix.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '/';
}

/**
 * Initializes the OpenTelemetry `NodeSDK` before NestJS or instrumented
 * libraries (`express`, `pg`, `redis`, `typeorm`) are imported.
 *
 * Returns `null` immediately when telemetry is disabled.
 */
export function initTelemetry(options: TelemetryOptions): NodeSDK | null {
  const enabled = options.enabled ?? process.env.OTEL_ENABLED !== 'false';
  if (!enabled) {
    return null;
  }

  if (activeSdk) {
    return activeSdk;
  }

  const serviceName =
    options.serviceName || process.env.OTEL_SERVICE_NAME || 'nest-service';
  const serviceVersion =
    options.serviceVersion || process.env.OTEL_SERVICE_VERSION || '1.0.0';
  const environment =
    options.environment || process.env.NODE_ENV || 'development';
  const otlpEndpoint =
    options.otlpEndpoint ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    'http://localhost:4318/v1/traces';

  const swaggerDocsPrefix = normalizePathPrefix(
    process.env.SWAGGER_DOCS_PATH || 'docs',
  );
  const ignorePaths = options.ignoreIncomingRequestPaths ?? [
    '/',
    '/health',
    '/health/live',
    '/health/ready',
  ];
  const ignorePathPrefixes = (
    options.ignoreIncomingRequestPathPrefixes ?? [swaggerDocsPrefix]
  ).map(normalizePathPrefix);

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': environment,
    }),
  );

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-net': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => {
            const rawPath = (request.url ?? '').split('?')[0] ?? '';
            if (ignorePaths.includes(rawPath)) {
              return true;
            }
            return ignorePathPrefixes.some(
              (prefix) =>
                rawPath === prefix ||
                rawPath.startsWith(`${prefix}/`) ||
                rawPath.startsWith(`${prefix}-`),
            );
          },
        },
      }),
    ],
  });

  sdk.start();
  activeSdk = sdk;

  if (!shutdownHooksRegistered) {
    shutdownHooksRegistered = true;
    const shutdown = () => {
      const sdkToStop = activeSdk;
      activeSdk = null;
      if (!sdkToStop) return;
      sdkToStop.shutdown().catch((err: unknown) => {
        console.error('Error shutting down OpenTelemetry SDK', err);
      });
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }

  return sdk;
}

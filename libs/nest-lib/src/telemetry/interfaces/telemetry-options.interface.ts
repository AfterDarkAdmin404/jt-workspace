export interface TelemetryOptions {
  /**
   * Enable or disable OpenTelemetry SDK initialization.
   * Defaults to `process.env.OTEL_ENABLED !== 'false'`.
   */
  enabled?: boolean;
  /**
   * Logical service name reported to the OpenTelemetry collector / Jaeger.
   */
  serviceName: string;
  /**
   * Service version attached to resource attributes.
   * Defaults to `process.env.OTEL_SERVICE_VERSION || '1.0.0'`.
   */
  serviceVersion?: string;
  /**
   * Deployment environment attached to resource attributes.
   * Defaults to `process.env.NODE_ENV || 'development'`.
   */
  environment?: string;
  /**
   * OTLP/HTTP trace exporter endpoint URL.
   * Defaults to `process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'`.
   */
  otlpEndpoint?: string;
  /**
   * Exact incoming HTTP request paths excluded from tracing (e.g. health checks).
   * Defaults to `['/', '/health']`.
   */
  ignoreIncomingRequestPaths?: string[];
  /**
   * Incoming HTTP request path prefixes excluded from tracing (e.g. Swagger docs).
   * Defaults to `['/' + (process.env.SWAGGER_DOCS_PATH || 'docs')]`.
   */
  ignoreIncomingRequestPathPrefixes?: string[];
}

export interface TelemetryModuleOptions {
  /**
   * Tracer name used by `TelemetryService` (`trace.getTracer(serviceName)`).
   */
  serviceName: string;
  /**
   * Register `TelemetryModule` as a global module. Defaults to `true`.
   */
  isGlobal?: boolean;
  /**
   * Attach `X-Trace-Id` response headers via global `APP_INTERCEPTOR`.
   * Defaults to `true`.
   */
  enableGlobalTraceHeader?: boolean;
  /**
   * Attach `traceId` (and `X-Trace-Id` header) on HTTP errors via global `APP_FILTER`.
   * Defaults to `true`.
   */
  enableGlobalExceptionFilter?: boolean;
}

export const TELEMETRY_OPTIONS = 'TELEMETRY_OPTIONS';

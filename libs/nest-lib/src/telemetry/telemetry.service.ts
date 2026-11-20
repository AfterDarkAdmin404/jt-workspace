import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type Attributes,
  isSpanContextValid,
  type Span,
  SpanStatusCode,
  trace,
  type Tracer,
} from '@opentelemetry/api';
import {
  TELEMETRY_OPTIONS,
  type TelemetryModuleOptions,
} from './interfaces/telemetry-options.interface';

@Injectable()
export class TelemetryService {
  private readonly tracer: Tracer;

  constructor(
    @Optional()
    @Inject(TELEMETRY_OPTIONS)
    options?: TelemetryModuleOptions,
  ) {
    const serviceName =
      options?.serviceName || process.env.OTEL_SERVICE_NAME || 'nest-service';
    this.tracer = trace.getTracer(serviceName);
  }

  /**
   * Returns the active trace ID from the current OpenTelemetry context, if any.
   */
  static getActiveTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return undefined;
    }

    const spanContext = activeSpan.spanContext();
    return isSpanContextValid(spanContext) ? spanContext.traceId : undefined;
  }

  /**
   * Executes an async operation inside a newly created active span, recording
   * any thrown exception and ensuring the span is always ended.
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      attributes ? { attributes } : {},
      async (span) => {
        try {
          return await fn(span);
        } catch (err) {
          span.recordException(
            err instanceof Error ? err : new Error(String(err)),
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Returns the active trace ID for log or HTTP response correlation, if any.
   */
  getActiveTraceId(): string | undefined {
    return TelemetryService.getActiveTraceId();
  }
}

import {
  DynamicModule,
  Global,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Optional,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TraceExceptionFilter } from './filters/trace-exception.filter';
import {
  TELEMETRY_OPTIONS,
  type TelemetryModuleOptions,
} from './interfaces/telemetry-options.interface';
import { TraceContextMiddleware } from './middleware/trace-context.middleware';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({})
export class TelemetryModule implements NestModule {
  constructor(
    @Optional()
    @Inject(TELEMETRY_OPTIONS)
    private readonly options?: TelemetryModuleOptions,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    if (this.options?.enableGlobalTraceHeader !== false) {
      consumer.apply(TraceContextMiddleware).forRoutes('{*path}');
    }
  }

  static forRoot(options: TelemetryModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TELEMETRY_OPTIONS,
        useValue: options,
      },
      TelemetryService,
    ];

    if (options.enableGlobalExceptionFilter !== false) {
      providers.push({
        provide: APP_FILTER,
        useClass: TraceExceptionFilter,
      });
    }

    return {
      module: TelemetryModule,
      global: options.isGlobal ?? true,
      providers,
      exports: [TelemetryService, TELEMETRY_OPTIONS],
    };
  }
}

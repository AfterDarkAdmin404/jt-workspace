import { DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TraceExceptionFilter } from './filters/trace-exception.filter';
import { TraceContextInterceptor } from './interceptors/trace-context.interceptor';
import {
  TELEMETRY_OPTIONS,
  type TelemetryModuleOptions,
} from './interfaces/telemetry-options.interface';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({})
export class TelemetryModule {
  static forRoot(options: TelemetryModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TELEMETRY_OPTIONS,
        useValue: options,
      },
      TelemetryService,
    ];

    if (options.enableGlobalTraceHeader !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TraceContextInterceptor,
      });
    }

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

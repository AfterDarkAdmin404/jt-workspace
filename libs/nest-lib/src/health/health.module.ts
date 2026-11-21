import { DynamicModule, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';
import {
  HEALTH_MODULE_OPTIONS,
  type HealthModuleAsyncOptions,
} from './interfaces/health-options.interface';

@Module({})
export class HealthModule {
  static forRootAsync(options: HealthModuleAsyncOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [
        ...(options.imports ?? []),
        TerminusModule.forRootAsync({
          imports: options.imports ?? [],
          inject: options.inject ?? [],
          useFactory: async (...args: any[]) => {
            const resolved = await options.useFactory(...args);
            return {
              gracefulShutdownTimeoutMs:
                resolved.gracefulShutdownTimeoutMs ?? 0,
            };
          },
        }),
      ],
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_MODULE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        RedisHealthIndicator,
      ],
      exports: [HEALTH_MODULE_OPTIONS, RedisHealthIndicator, TerminusModule],
    };
  }
}

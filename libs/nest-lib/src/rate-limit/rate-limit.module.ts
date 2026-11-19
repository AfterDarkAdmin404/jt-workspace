import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { DynamicThrottlerGuard } from './dynamic-throttler.guard';
import {
  RATE_LIMIT_OPTIONS,
  type RateLimitAsyncOptions,
} from './interfaces/rate-limit-options.interface';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({})
export class DynamicRateLimitModule {
  static forRootAsync(options: RateLimitAsyncOptions): DynamicModule {
    return {
      module: DynamicRateLimitModule,
      imports: [
        ...(options.imports ?? []),
        ThrottlerModule.forRootAsync({
          imports: options.imports ?? [],
          inject: [...(options.inject ?? []), RedisThrottlerStorage],
          useFactory: async (
            ...args: any[]
          ): Promise<ThrottlerModuleOptions> => {
            const storage = args[args.length - 1] as RedisThrottlerStorage;
            const userArgs = args.slice(0, args.length - 1);
            const resolved = await options.useFactory(...userArgs);

            return {
              throttlers: [
                {
                  name: 'default',
                  ttl: (resolved.defaultTtl || 60) * 1000,
                  limit: resolved.defaultLimit || 100,
                },
              ],
              storage,
            };
          },
        }),
      ],
      providers: [
        {
          provide: RATE_LIMIT_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        RedisThrottlerStorage,
        DynamicThrottlerGuard,
      ],
      exports: [
        RATE_LIMIT_OPTIONS,
        RedisThrottlerStorage,
        DynamicThrottlerGuard,
        ThrottlerModule,
      ],
    };
  }
}

import { createKeyv } from '@keyv/redis';
import { CacheModule, type CacheModuleOptions } from '@nestjs/cache-manager';
import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import {
  REDIS_CACHE_OPTIONS,
  type RedisCacheAsyncOptions,
  type RedisCacheModuleOptions,
} from './interfaces/redis-cache-options.interface';
import { RedisCacheService } from './redis-cache.service';

function buildRedisUrl(opts: RedisCacheModuleOptions): string {
  const auth =
    opts.username || opts.password
      ? `${encodeURIComponent(opts.username ?? '')}:${encodeURIComponent(opts.password ?? '')}@`
      : '';
  const db = opts.db ?? 0;
  return `redis://${auth}${opts.host}:${opts.port}/${db}`;
}

@Global()
@Module({})
export class RedisCacheModule {
  private static readonly logger = new Logger(RedisCacheModule.name);

  static forRootAsync(options: RedisCacheAsyncOptions): DynamicModule {
    return {
      module: RedisCacheModule,
      imports: [
        ...(options.imports ?? []),
        CacheModule.registerAsync({
          isGlobal: true,
          imports: options.imports ?? [],
          inject: options.inject ?? [],
          useFactory: async (...args: any[]): Promise<CacheModuleOptions> => {
            const opts = await options.useFactory(...args);
            const ttl = opts.ttl ?? 300_000;

            if (opts.enabled === false) {
              this.logger.log(
                'REDIS_ENABLED=false; falling back to in-memory cache store',
              );
              return { ttl };
            }

            const redisUrl = buildRedisUrl(opts);
            const keyvStore = createKeyv(redisUrl);
            keyvStore.on('error', (err: unknown) => {
              this.logger.error(
                `Redis cache error: ${err instanceof Error ? err.message : String(err)}`,
              );
            });

            return {
              ttl,
              stores: [keyvStore],
            };
          },
        }),
      ],
      providers: [
        {
          provide: REDIS_CACHE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        RedisCacheService,
      ],
      exports: [CacheModule, RedisCacheService, REDIS_CACHE_OPTIONS],
    };
  }
}

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Cache } from 'cache-manager';
import { createClient } from 'redis';
import {
  REDIS_CACHE_OPTIONS,
  type RedisCacheModuleOptions,
} from '../../cache/interfaces/redis-cache-options.interface';

interface PingableRedisClient {
  isOpen?: boolean;
  isReady?: boolean;
  ping(): Promise<string>;
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

interface KeyvRedisLikeStore {
  client?: PingableRedisClient;
  getClient?: () => Promise<PingableRedisClient>;
}

function isKeyvRedisStore(store: unknown): store is KeyvRedisLikeStore {
  if (!store || typeof store !== 'object') return false;
  const candidate = store as KeyvRedisLikeStore;
  return (
    typeof candidate.getClient === 'function' ||
    (!!candidate.client && typeof candidate.client.ping === 'function')
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    @Inject(REDIS_CACHE_OPTIONS)
    private readonly redisOptions?: RedisCacheModuleOptions,
  ) {}

  async isHealthy<const TKey extends string = 'redis'>(
    key: TKey = 'redis' as TKey,
    timeoutMs = 2000,
  ): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    if (this.redisOptions?.enabled === false) {
      return indicator.up({ mode: 'in-memory-fallback' });
    }

    try {
      const pong = await withTimeout(
        this.pingRedis(timeoutMs),
        timeoutMs,
        'Redis ping',
      );
      if (pong !== 'PONG') {
        return indicator.down({
          message: `Unexpected Redis PING response: ${String(pong)}`,
        });
      }
      return indicator.up();
    } catch (err) {
      return indicator.down({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async pingRedis(timeoutMs: number): Promise<string> {
    const store = this.findKeyvRedisStore();
    if (store) {
      const rawClient = store.client;
      if (rawClient?.isOpen && rawClient.isReady === false) {
        throw new Error('Redis client is disconnected or reconnecting');
      }

      const client = store.getClient ? await store.getClient() : rawClient;
      if (!client || typeof client.ping !== 'function') {
        throw new Error('Redis client does not expose ping()');
      }
      if (client.isReady === false) {
        throw new Error('Redis client is not ready');
      }
      return client.ping();
    }

    if (!this.redisOptions) {
      throw new Error('Redis cache store is not configured');
    }

    const auth =
      this.redisOptions.username || this.redisOptions.password
        ? `${encodeURIComponent(this.redisOptions.username ?? '')}:${encodeURIComponent(this.redisOptions.password ?? '')}@`
        : '';
    const url = `redis://${auth}${this.redisOptions.host}:${this.redisOptions.port}/${this.redisOptions.db ?? 0}`;
    const tempClient = createClient({
      url,
      socket: {
        connectTimeout: timeoutMs,
        reconnectStrategy: false,
      },
    });
    tempClient.on('error', () => undefined);

    try {
      await tempClient.connect();
      return await tempClient.ping();
    } finally {
      if (tempClient.isOpen) {
        await tempClient.disconnect().catch(() => undefined);
      }
    }
  }

  private findKeyvRedisStore(): KeyvRedisLikeStore | undefined {
    const stores = this.cacheManager?.stores;
    if (!Array.isArray(stores)) {
      return undefined;
    }

    for (const keyv of stores) {
      const innerStore = (keyv as { store?: unknown } | undefined)?.store;
      if (isKeyvRedisStore(innerStore)) {
        return innerStore;
      }
    }
    return undefined;
  }
}

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  REDIS_CACHE_OPTIONS,
  type RedisCacheModuleOptions,
} from './interfaces/redis-cache-options.interface';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly keyPrefix: string;

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional()
    @Inject(REDIS_CACHE_OPTIONS)
    private readonly options?: RedisCacheModuleOptions,
  ) {
    this.keyPrefix = options?.keyPrefix ?? '';
  }

  private prefixKey(key: string): string {
    if (!this.keyPrefix || key.startsWith(this.keyPrefix)) {
      return key;
    }
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(this.prefixKey(key));
      return value ?? undefined;
    } catch (err) {
      this.logger.warn(
        `Cache GET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttlMs =
      ttlSeconds !== undefined ? ttlSeconds * 1000 : this.options?.ttl;
    try {
      await this.cacheManager.set(this.prefixKey(key), value, ttlMs);
    } catch (err) {
      this.logger.warn(
        `Cache SET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(this.prefixKey(key));
    } catch (err) {
      this.logger.warn(
        `Cache DEL failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async reset(): Promise<void> {
    try {
      await this.cacheManager.clear();
    } catch (err) {
      this.logger.warn(
        `Cache CLEAR failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

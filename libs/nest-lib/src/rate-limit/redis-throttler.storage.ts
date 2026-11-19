import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { createClient, type RedisClientType } from 'redis';
import {
  RATE_LIMIT_OPTIONS,
  type RateLimitModuleOptions,
} from './interfaces/rate-limit-options.interface';

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly keyPrefix: string;
  private client: RedisClientType | null = null;
  private isReady = false;

  constructor(
    @Optional()
    @Inject(RATE_LIMIT_OPTIONS)
    private readonly options?: RateLimitModuleOptions,
  ) {
    const basePrefix = options?.redis?.keyPrefix ?? 'ikagi:';
    this.keyPrefix = `${basePrefix}throttle:`;
  }

  async onModuleInit(): Promise<void> {
    const redisOpts = this.options?.redis;
    if (!this.options?.enabled || redisOpts?.enabled === false) {
      return;
    }

    const host = redisOpts?.host ?? 'localhost';
    const port = redisOpts?.port ?? 6379;
    const db = redisOpts?.db ?? 0;

    this.client = createClient({
      socket: {
        host,
        port,
        connectTimeout: 2000,
        reconnectStrategy: (retries) => Math.min(retries * 500, 5000),
      },
      username: redisOpts?.username || undefined,
      password: redisOpts?.password || undefined,
      database: db,
    });

    this.client.on('ready', () => {
      this.isReady = true;
    });

    this.client.on('end', () => {
      this.isReady = false;
    });

    this.client.on('error', (err: unknown) => {
      this.isReady = false;
      this.logger.warn(
        `Redis throttler unavailable (failing open): ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    this.client.connect().catch((err: unknown) => {
      this.isReady = false;
      this.logger.warn(
        `Initial Redis throttler connection failed (failing open): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const timeToExpireSec = Math.ceil(ttl / 1000);
    if (!this.client || !this.isReady) {
      return {
        totalHits: 0,
        timeToExpire: timeToExpireSec,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const prefixedKey = `${this.keyPrefix}${throttlerName}:${key}`;
    try {
      const totalHits = await this.client.incr(prefixedKey);
      let remainingMs = ttl;

      if (totalHits === 1) {
        await this.client.pExpire(prefixedKey, ttl);
      } else {
        const pttl = await this.client.pTTL(prefixedKey);
        if (pttl < 0) {
          await this.client.pExpire(prefixedKey, ttl);
        } else {
          remainingMs = pttl;
        }
      }

      const isBlocked = totalHits > limit;
      return {
        totalHits,
        timeToExpire: Math.max(1, Math.ceil(remainingMs / 1000)),
        isBlocked,
        timeToBlockExpire: isBlocked
          ? Math.max(1, Math.ceil((blockDuration || remainingMs) / 1000))
          : 0,
      };
    } catch (err) {
      this.logger.warn(
        `Redis throttler increment failed (failing open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        totalHits: 0,
        timeToExpire: timeToExpireSec,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}

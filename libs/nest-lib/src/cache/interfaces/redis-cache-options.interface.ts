import type { ModuleMetadata } from '@nestjs/common';

export interface RedisCacheModuleOptions {
  enabled?: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  keyPrefix?: string;
  /** Default TTL in milliseconds (cache-manager v6+) */
  ttl?: number;
}

export interface RedisCacheAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<RedisCacheModuleOptions> | RedisCacheModuleOptions;
}

export const REDIS_CACHE_OPTIONS = 'REDIS_CACHE_OPTIONS';

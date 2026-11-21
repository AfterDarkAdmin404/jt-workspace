import type { ConfigService } from '@nestjs/config';
import type { RedisConnectionOptions } from '@jt-workspace/nest-lib';
import { getBooleanFlag, getNumberValue } from './config.helpers';

const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_DB = 0;

/**
 * Returns whether Redis integration is enabled via `REDIS_ENABLED`.
 */
export function isRedisEnabled(configService: ConfigService): boolean {
  return getBooleanFlag(configService, 'REDIS_ENABLED', true);
}

/**
 * Builds shared Redis connection options used across cache and rate-limit modules.
 */
export function getRedisConnectionOptions(
  configService: ConfigService,
): RedisConnectionOptions {
  return {
    enabled: isRedisEnabled(configService),
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: getNumberValue(configService, 'REDIS_PORT', DEFAULT_REDIS_PORT, 1),
    username: configService.get<string>('REDIS_USERNAME') || undefined,
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
    db: getNumberValue(configService, 'REDIS_DB', DEFAULT_REDIS_DB, 0),
    keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'ikagi:'),
  };
}

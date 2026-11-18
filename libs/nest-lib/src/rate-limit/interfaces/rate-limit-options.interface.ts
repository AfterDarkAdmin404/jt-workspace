import { Logger, type ModuleMetadata } from '@nestjs/common';

export interface RateLimitRule {
  /** Time-to-live window in seconds */
  ttl: number;
  /** Maximum requests allowed within the TTL window */
  limit: number;
}

export interface RedisConnectionOptions {
  enabled?: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RateLimitModuleOptions {
  enabled: boolean;
  /** Global default TTL in seconds */
  defaultTtl: number;
  /** Global default max requests per TTL window */
  defaultLimit: number;
  profiles: Record<string, RateLimitRule>;
  redis?: RedisConnectionOptions;
}

export interface RateLimitAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<RateLimitModuleOptions> | RateLimitModuleOptions;
}

export const RATE_LIMIT_OPTIONS = 'RATE_LIMIT_OPTIONS';
export const RATE_LIMIT_PROFILE_KEY = 'RATE_LIMIT_PROFILE_KEY';

export function parseRateLimitProfiles(
  raw?: string,
  logger = new Logger('RateLimitConfig')
): Record<string, RateLimitRule> {
  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn(
        'RATE_LIMIT_PROFILES must be a JSON object; falling back to global defaults'
      );
      return {};
    }

    const validProfiles: Record<string, RateLimitRule> = {};
    for (const [name, rule] of Object.entries(parsed)) {
      if (
        rule &&
        typeof rule === 'object' &&
        typeof (rule as RateLimitRule).ttl === 'number' &&
        typeof (rule as RateLimitRule).limit === 'number' &&
        (rule as RateLimitRule).ttl > 0 &&
        (rule as RateLimitRule).limit > 0
      ) {
        validProfiles[name.trim()] = {
          ttl: (rule as RateLimitRule).ttl,
          limit: (rule as RateLimitRule).limit,
        };
      } else {
        logger.warn(
          `Ignoring invalid rate-limit profile "${name}"; expected { ttl: number > 0, limit: number > 0 }`
        );
      }
    }
    return validProfiles;
  } catch (err) {
    logger.warn(
      `Malformed RATE_LIMIT_PROFILES JSON (${err instanceof Error ? err.message : String(err)}); falling back to global defaults`
    );
    return {};
  }
}

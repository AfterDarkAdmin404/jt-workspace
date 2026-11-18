import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { DynamicThrottlerGuard } from '../dynamic-throttler.guard';
import {
  RATE_LIMIT_PROFILE_KEY,
  type RateLimitRule,
} from '../interfaces/rate-limit-options.interface';

export type DynamicRateLimitMetadata = string | RateLimitRule | null;

/**
 * Opt-in rate limiting decorator for controllers or route handlers.
 *
 * - `@DynamicRateLimit()` uses `RATE_LIMIT_DEFAULT_TTL` / `RATE_LIMIT_DEFAULT_LIMIT`
 * - `@DynamicRateLimit('auth')` resolves the named profile from `RATE_LIMIT_PROFILES`
 * - `@DynamicRateLimit({ ttl: 30, limit: 10 })` applies an inline override
 */
export function DynamicRateLimit(
  profileOrOptions?: string | RateLimitRule
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_PROFILE_KEY, profileOrOptions ?? null),
    UseGuards(DynamicThrottlerGuard)
  );
}

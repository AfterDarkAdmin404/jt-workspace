import { ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { DynamicRateLimitMetadata } from './decorators/dynamic-rate-limit.decorator';
import {
  RATE_LIMIT_OPTIONS,
  RATE_LIMIT_PROFILE_KEY,
  type RateLimitModuleOptions,
  type RateLimitRule,
} from './interfaces/rate-limit-options.interface';

@Injectable()
export class DynamicThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @Optional()
    @Inject(RATE_LIMIT_OPTIONS)
    private readonly rateLimitOptions?: RateLimitModuleOptions,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.rateLimitOptions?.enabled === false) {
      return true;
    }

    const metadata = this.getDecoratorMetadata(context);
    if (metadata === undefined) {
      return true;
    }

    return super.canActivate(context);
  }

  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      const firstHop = forwardedFor.split(',')[0]?.trim();
      if (firstHop) return firstHop;
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      const firstHop = String(forwardedFor[0]).split(',')[0]?.trim();
      if (firstHop) return firstHop;
    }

    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  protected override generateKey(
    context: ExecutionContext,
    suffix: string,
    _name: string,
  ): string {
    const metadata = this.getDecoratorMetadata(context);
    const profileLabel =
      typeof metadata === 'string'
        ? metadata
        : metadata && typeof metadata === 'object'
          ? 'custom'
          : 'default';
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    return `${profileLabel}:${controller}:${handler}:${suffix}`;
  }

  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context } = requestProps;
    const metadata = this.getDecoratorMetadata(context);

    if (metadata === undefined || !this.rateLimitOptions) {
      return super.handleRequest(requestProps);
    }

    const rule = this.resolveRule(metadata);
    return super.handleRequest({
      ...requestProps,
      limit: rule.limit,
      ttl: rule.ttl * 1000,
    });
  }

  private getDecoratorMetadata(
    context: ExecutionContext,
  ): DynamicRateLimitMetadata | undefined {
    return this.reflector.getAllAndOverride<
      DynamicRateLimitMetadata | undefined
    >(RATE_LIMIT_PROFILE_KEY, [context.getHandler(), context.getClass()]);
  }

  private resolveRule(metadata: DynamicRateLimitMetadata): RateLimitRule {
    const fallback: RateLimitRule = {
      ttl: this.rateLimitOptions?.defaultTtl || 60,
      limit: this.rateLimitOptions?.defaultLimit || 100,
    };

    if (metadata === null) {
      return fallback;
    }

    if (typeof metadata === 'string') {
      const profile = this.rateLimitOptions?.profiles?.[metadata];
      if (!profile) {
        this.logger.warn(
          `Rate-limit profile "${metadata}" not found in RATE_LIMIT_PROFILES; falling back to default (${fallback.limit} req / ${fallback.ttl}s)`,
        );
        return fallback;
      }
      return profile;
    }

    if (
      typeof metadata === 'object' &&
      typeof metadata.ttl === 'number' &&
      typeof metadata.limit === 'number'
    ) {
      return metadata;
    }

    return fallback;
  }
}

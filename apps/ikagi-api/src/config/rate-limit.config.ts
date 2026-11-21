import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  parseRateLimitProfiles,
  type RateLimitAsyncOptions,
} from '@jt-workspace/nest-lib';
import { getBooleanFlag, getNumberValue } from './config.helpers';
import { getRedisConnectionOptions } from './redis.config';

const DEFAULT_RATE_LIMIT_TTL_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

export const rateLimitConfig: RateLimitAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    enabled: getBooleanFlag(configService, 'RATE_LIMIT_ENABLED', true),
    defaultTtl: getNumberValue(
      configService,
      'RATE_LIMIT_DEFAULT_TTL',
      DEFAULT_RATE_LIMIT_TTL_SECONDS,
      1,
    ),
    defaultLimit: getNumberValue(
      configService,
      'RATE_LIMIT_DEFAULT_LIMIT',
      DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      1,
    ),
    profiles: parseRateLimitProfiles(
      configService.get<string>('RATE_LIMIT_PROFILES'),
    ),
    redis: getRedisConnectionOptions(configService),
  }),
};

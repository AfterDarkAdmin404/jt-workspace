import { ConfigModule, ConfigService } from '@nestjs/config';
import type { RedisCacheAsyncOptions } from '@jt-workspace/nest-lib';
import { getNumberValue } from './config.helpers';
import { getRedisConnectionOptions } from './redis.config';

const DEFAULT_REDIS_TTL_SECONDS = 300;

export const redisCacheConfig: RedisCacheAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    ...getRedisConnectionOptions(configService),
    ttl:
      getNumberValue(configService, 'REDIS_TTL', DEFAULT_REDIS_TTL_SECONDS, 0) *
      1000,
  }),
};

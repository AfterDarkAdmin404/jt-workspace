import { ConfigModule, ConfigService } from '@nestjs/config';
import type { HealthModuleAsyncOptions } from '@jt-workspace/nest-lib';
import { APP_NAME } from './app.config';
import { getNumberValue } from './config.helpers';
import { isRedisEnabled } from './redis.config';

const DEFAULT_HEALTH_DB_TIMEOUT_MS = 3000;
const DEFAULT_HEALTH_MEMORY_HEAP_MB = 300;
const BYTES_PER_MIB = 1024 * 1024;

export const healthConfig: HealthModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const dbTimeoutMs = getNumberValue(
      configService,
      'HEALTH_DB_TIMEOUT_MS',
      DEFAULT_HEALTH_DB_TIMEOUT_MS,
      1,
    );
    const memoryHeapMb = getNumberValue(
      configService,
      'HEALTH_MEMORY_HEAP_MB',
      DEFAULT_HEALTH_MEMORY_HEAP_MB,
      1,
    );

    return {
      serviceName: APP_NAME,
      enableDatabaseCheck: true,
      databaseTimeoutMs: dbTimeoutMs,
      enableRedisCheck: isRedisEnabled(configService),
      enableMemoryCheck: true,
      memoryHeapThresholdBytes: memoryHeapMb * BYTES_PER_MIB,
      externalEndpoints: [],
      // Example for future service indicators:
      // customIndicators: [() => customServiceHealth.isHealthy('billing')],
      customIndicators: [],
    };
  },
};

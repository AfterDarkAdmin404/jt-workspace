import type { ModuleMetadata } from '@nestjs/common';
import type { HealthIndicatorFunction } from '@nestjs/terminus';

export interface ExternalHealthEndpoint {
  /** Key name used in the Terminus health check result object. */
  key: string;
  /** Target HTTP/HTTPS URL to probe. */
  url: string;
  /** Request timeout in milliseconds (defaults to `3000`). */
  timeoutMs?: number;
}

export interface HealthModuleOptions {
  /** Logical service name (used for logging/context, e.g. `'ikagi-api'`). */
  serviceName: string;
  /** Enable TypeORM PostgreSQL `SELECT 1` ping check (defaults to `true`). */
  enableDatabaseCheck?: boolean;
  /** TypeORM ping timeout in milliseconds (defaults to `3000`). */
  databaseTimeoutMs?: number;
  /** Enable Redis ping check (defaults to `true`). */
  enableRedisCheck?: boolean;
  /** Redis ping timeout in milliseconds (defaults to `2000`). */
  redisTimeoutMs?: number;
  /** Enable process heap memory check (defaults to `true`). */
  enableMemoryCheck?: boolean;
  /** Heap threshold in bytes for memory check (defaults to `300 * 1024 * 1024`). */
  memoryHeapThresholdBytes?: number;
  /** Graceful shutdown delay in milliseconds passed to `TerminusModule` (defaults to `0`). */
  gracefulShutdownTimeoutMs?: number;
  /** Optional downstream HTTP endpoints checked via `FetchHealthIndicator`. */
  externalEndpoints?: ExternalHealthEndpoint[];
  /** Optional custom `HealthIndicatorFunction` hooks appended to readiness checks. */
  customIndicators?: HealthIndicatorFunction[];
}

export interface HealthModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<HealthModuleOptions> | HealthModuleOptions;
}

export const HEALTH_MODULE_OPTIONS = 'HEALTH_MODULE_OPTIONS';

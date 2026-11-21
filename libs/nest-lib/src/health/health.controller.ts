import {
  Controller,
  Get,
  Inject,
  Optional,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  FetchHealthIndicator,
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  type HealthIndicatorFunction,
  HealthIndicatorService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';
import {
  HEALTH_MODULE_OPTIONS,
  type HealthModuleOptions,
} from './interfaces/health-options.interface';

const DEFAULT_DB_TIMEOUT_MS = 3000;
const DEFAULT_REDIS_TIMEOUT_MS = 2000;
const DEFAULT_MEMORY_HEAP_BYTES = 300 * 1024 * 1024;
const DEFAULT_ENDPOINT_TIMEOUT_MS = 3000;

@ApiTags('Health')
@Controller({ path: '/', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(HEALTH_MODULE_OPTIONS)
    private readonly options: HealthModuleOptions,
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly fetchHealth: FetchHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    @Optional()
    private readonly typeOrm?: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Runs lightweight in-process checks (memory heap) without hitting external databases or caches.',
  })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  @ApiResponse({ status: 503, description: 'Process is unhealthy or shutting down' })
  checkLiveness(): Promise<HealthCheckResult> {
    return this.runLiveness();
  }

  @Get('health/live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe (alias)',
    description:
      'Alias of GET / running lightweight in-process checks (memory heap).',
  })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  @ApiResponse({ status: 503, description: 'Process is unhealthy or shutting down' })
  checkLivenessAlias(): Promise<HealthCheckResult> {
    return this.runLiveness();
  }

  @Get('health')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Verifies PostgreSQL, Redis, configured external endpoints, and custom health indicators.',
  })
  @ApiResponse({ status: 200, description: 'All readiness dependencies are up' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are down or application is shutting down',
  })
  checkReadiness(): Promise<HealthCheckResult> {
    return this.runReadiness();
  }

  @Get('health/ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe (alias)',
    description:
      'Alias of GET /health verifying PostgreSQL, Redis, configured external endpoints, and custom health indicators.',
  })
  @ApiResponse({ status: 200, description: 'All readiness dependencies are up' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are down or application is shutting down',
  })
  checkReadinessAlias(): Promise<HealthCheckResult> {
    return this.runReadiness();
  }

  private runLiveness(): Promise<HealthCheckResult> {
    const indicators: HealthIndicatorFunction[] = [];

    if (this.options.enableMemoryCheck !== false) {
      const heapThresholdBytes =
        this.options.memoryHeapThresholdBytes ?? DEFAULT_MEMORY_HEAP_BYTES;
      indicators.push(() =>
        this.memory.checkHeap('memory_heap', heapThresholdBytes),
      );
    }

    return this.health.check(indicators);
  }

  private runReadiness(): Promise<HealthCheckResult> {
    const indicators: HealthIndicatorFunction[] = [];

    if (this.options.enableDatabaseCheck !== false) {
      const dbTimeoutMs =
        this.options.databaseTimeoutMs ?? DEFAULT_DB_TIMEOUT_MS;
      if (this.typeOrm) {
        indicators.push(() =>
          this.typeOrm!.pingCheck('database').withTimeout(dbTimeoutMs),
        );
      } else {
        indicators.push(() =>
          this.healthIndicatorService
            .check('database')
            .down({ message: 'TypeOrmHealthIndicator is not available' }),
        );
      }
    }

    if (this.options.enableRedisCheck !== false) {
      const redisTimeoutMs =
        this.options.redisTimeoutMs ?? DEFAULT_REDIS_TIMEOUT_MS;
      indicators.push(() => this.redis.isHealthy('redis', redisTimeoutMs));
    }

    for (const endpoint of this.options.externalEndpoints ?? []) {
      indicators.push(() =>
        this.fetchHealth
          .pingCheck(endpoint.key, endpoint.url)
          .withTimeout(endpoint.timeoutMs ?? DEFAULT_ENDPOINT_TIMEOUT_MS),
      );
    }

    if (this.options.customIndicators?.length) {
      indicators.push(...this.options.customIndicators);
    }

    return this.health.check(indicators);
  }
}

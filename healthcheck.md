# Health Check Guide (`@nestjs/terminus`)

This workspace provides an extensible NestJS health check module in `@jt-workspace/nest-lib` (`libs/nest-lib/src/health/`) built on `@nestjs/terminus`, exposing standardized liveness and readiness probes for `apps/ikagi-api` and future NestJS services.

---

## Architecture Overview

1. **Reusable Module ([`HealthModule`](libs/nest-lib/src/health/health.module.ts))**
   - Registered asynchronously via `HealthModule.forRootAsync(...)` and backed by `TerminusModule.forRootAsync(...)`.
   - Supports optional graceful shutdown delay (`gracefulShutdownTimeoutMs`) aligned with NestJS `app.enableShutdownHooks()`.
2. **Probe Endpoints ([`HealthController`](libs/nest-lib/src/health/health.controller.ts))**
   - Marked `@ApiTags('Health')` and `VERSION_NEUTRAL`, and intentionally undecorated by `@DynamicRateLimit()` so orchestrator probes are never throttled.
   - Excluded from `app.setGlobalPrefix('api')` in [`apps/ikagi-api/src/main.ts`](apps/ikagi-api/src/main.ts) and ignored by OpenTelemetry in [`libs/nest-lib/src/telemetry/tracing.ts`](libs/nest-lib/src/telemetry/tracing.ts) so probes do not flood Jaeger traces.
3. **Built-in & Custom Indicators**
   - **Memory (`MemoryHealthIndicator`):** Checks V8 heap usage (`checkHeap`) for liveness.
   - **PostgreSQL (`TypeOrmHealthIndicator`):** Runs TypeORM `SELECT 1` ping (`@Optional()` DI so DB-less services can set `enableDatabaseCheck: false`).
   - **Redis ([`RedisHealthIndicator`](libs/nest-lib/src/health/indicators/redis.health.ts)):** Uses Terminus v12 `HealthIndicatorService` to ping the active `@keyv/redis` client from `CACHE_MANAGER` (with timeout protection and `REDIS_CACHE_OPTIONS` fallback). Returns `{ status: 'up', mode: 'in-memory-fallback' }` when `REDIS_ENABLED=false`.
   - **Downstream HTTP (`FetchHealthIndicator`):** Probes configured `externalEndpoints` via native `fetch`.
   - **Extensible Hooks (`customIndicators`):** Accepts arbitrary `HealthIndicatorFunction[]` callbacks.

---

## Endpoints

| Probe         | Routes                               | Checks Executed                                                                                 | Healthy / Failure Status                                                      |
| :------------ | :----------------------------------- | :---------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Liveness**  | `GET /`<br>`GET /health/live`        | `memory_heap` (`MemoryHealthIndicator.checkHeap`)                                               | `200 OK` (`status: "ok"`) / `503` if heap threshold exceeded or shutting down |
| **Readiness** | `GET /health`<br>`GET /health/ready` | `database` (TypeORM), `redis` (`RedisHealthIndicator`), `externalEndpoints`, `customIndicators` | `200 OK` (`status: "ok"`) / `503 Service Unavailable` (`status: "error"`)     |

> **Why separate liveness and readiness?** Transient PostgreSQL or Redis outages cause `/health` and `/health/ready` to return `503` (removing the instance from load-balancer rotation) while `/` and `/health/live` stay `200` to prevent container restart storms.

---

## Configuration Reference

### Environment Variables (`apps/ikagi-api`)

| Variable                | Default | Description                                                                    |
| :---------------------- | :------ | :----------------------------------------------------------------------------- |
| `HEALTH_DB_TIMEOUT_MS`  | `3000`  | PostgreSQL `SELECT 1` ping timeout in milliseconds                             |
| `HEALTH_MEMORY_HEAP_MB` | `300`   | V8 heap threshold in megabytes for liveness checks                             |
| `REDIS_ENABLED`         | `true`  | When `'false'`, Redis indicator reports `up` with `mode: "in-memory-fallback"` |

### `HealthModuleOptions` ([`health-options.interface.ts`](libs/nest-lib/src/health/interfaces/health-options.interface.ts))

| Option                      | Type                        | Default             | Description                                                                                |
| :-------------------------- | :-------------------------- | :------------------ | :----------------------------------------------------------------------------------------- |
| `serviceName`               | `string`                    | _(required)_        | Logical service identifier                                                                 |
| `enableDatabaseCheck`       | `boolean`                   | `true`              | Enable TypeORM `pingCheck('database')`                                                     |
| `databaseTimeoutMs`         | `number`                    | `3000`              | Timeout for database ping                                                                  |
| `enableRedisCheck`          | `boolean`                   | `true`              | Enable `RedisHealthIndicator`                                                              |
| `redisTimeoutMs`            | `number`                    | `2000`              | Timeout for Redis `PING`                                                                   |
| `enableMemoryCheck`         | `boolean`                   | `true`              | Enable `MemoryHealthIndicator.checkHeap` on liveness probes                                |
| `memoryHeapThresholdBytes`  | `number`                    | `300 * 1024 * 1024` | Heap limit in bytes                                                                        |
| `gracefulShutdownTimeoutMs` | `number`                    | `0`                 | Delay in ms before server shutdown completes (when `app.enableShutdownHooks()` is enabled) |
| `externalEndpoints`         | `ExternalHealthEndpoint[]`  | `[]`                | Downstream HTTP services `{ key, url, timeoutMs? }`                                        |
| `customIndicators`          | `HealthIndicatorFunction[]` | `[]`                | Custom Terminus indicator callbacks                                                        |

---

## Verification & Testing

1. **Start infrastructure and API:**
   ```sh
   yarn infra:up
   yarn nx build @jt-workspace/nest-lib
   yarn nx serve @org/ikagi-api
   ```
2. **Verify healthy probes** (using `PORT=3001` from `apps/ikagi-api/.env.dev`):
   - `GET http://localhost:3001/` → `200 OK` (`details.memory_heap.status: "up"`)
   - `GET http://localhost:3001/health` → `200 OK` (`details.database.status: "up"`, `details.redis.status: "up"`)
3. **Verify degraded readiness vs. stable liveness:**
   ```sh
   docker stop jt-redis
   # GET http://localhost:3001/health       -> 503 Service Unavailable (error.redis.status: "down")
   # GET http://localhost:3001/             -> 200 OK (liveness stays up)
   docker start jt-redis
   ```

---

## Extending with New Indicators or Onboarding Another Service

### Adding Downstream Checks to `ikagi-api`

Update `HealthModule.forRootAsync(...)` in [`apps/ikagi-api/src/app/app.module.ts`](apps/ikagi-api/src/app/app.module.ts):

```ts
HealthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService, HealthIndicatorService],
  useFactory: (
    configService: ConfigService,
    indicatorService: HealthIndicatorService,
  ) => ({
    serviceName: 'ikagi-api',
    externalEndpoints: [
      {
        key: 'billing_api',
        url: 'http://billing:3002/health',
        timeoutMs: 2000,
      },
    ],
    customIndicators: [async () => indicatorService.check('worker_queue').up()],
  }),
});
```

### Onboarding a New NestJS App

1. Import `HealthModule.forRootAsync(...)` in the app's `AppModule` (set `enableDatabaseCheck: false` if the service does not use `TypeOrmModule`).
2. Exclude `'/'`, `'health'`, `'health/live'`, and `'health/ready'` from `app.setGlobalPrefix(...)` if a global prefix is enabled.
3. Call `app.enableShutdownHooks()` in `main.ts` so Terminus reports `shutting_down` (`503`) during `SIGTERM`/`SIGINT` drains.

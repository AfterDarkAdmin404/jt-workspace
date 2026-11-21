# Task: Implement Extensible NestJS Health Check Module with `@nestjs/terminus` in `libs/nest-lib` and Integrate into `apps/ikag-api`

## Context

* **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and backend service `apps/ikag-api`).
* **Existing Services & Infrastructure:**
* **Database:** PostgreSQL (`db_ikag`) managed via TypeORM (`@nestjs/typeorm`, `typeorm`).
* **Cache / Rate-Limit Store:** Redis (`redis:7-alpine`) configured via `RedisCacheModule` in `libs/nest-lib/src/cache/` (`REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`).
* **Observability:** OpenTelemetry (`libs/nest-lib/src/telemetry/`) configured to ignore `/` and `/health` from incoming HTTP trace noise.


* **Routing & API Conventions:**
* Root path `GET /` is reserved for health checks (undecorated by `@DynamicRateLimit` so probes are never throttled).
* Swagger UI is served at `/docs` and `/docs/auth` (`@ApiTags('Health')`).


* **Health Check Stack (Implicit Defaults):**
* `@nestjs/terminus` (v11+ using `HealthIndicatorService` for custom indicators and `FetchHealthIndicator` instead of the deprecated `HttpHealthIndicator`).
* Reusable `HealthModule` placed in `libs/nest-lib/src/health/` so `apps/ikag-api` and all future monorepo NestJS services inherit standardized liveness/readiness probes and pluggable indicator registration.



---

## Objective 1: Build Extensible Reusable Health Module in `libs/nest-lib`

Encapsulate `@nestjs/terminus`, built-in infrastructure indicators (PostgreSQL/TypeORM, Redis, Memory), and a pluggable custom-indicator registry inside `libs/nest-lib/src/health/` so any NestJS service can add new downstream health checks without modifying the core controller.

### Requirements:

1. **Install Dependencies:**
* Install `@nestjs/terminus` in root `/package.json` (and add to `libs/nest-lib/package.json` peerDependencies/dependencies as required by the workspace).


2. **Define Health Module Interfaces (`libs/nest-lib/src/health/interfaces/health-options.interface.ts`):**
* Define `HealthModuleOptions` and `HealthModuleAsyncOptions` (`imports`, `inject`, `useFactory`):
* `serviceName: string` (e.g., `'ikag-api'`)
* `enableDatabaseCheck?: boolean` (defaults to `true`; runs TypeORM `SELECT 1` ping)
* `databaseTimeoutMs?: number` (defaults to `3000`)
* `enableRedisCheck?: boolean` (defaults to `true` when `REDIS_ENABLED !== 'false'`)
* `enableMemoryCheck?: boolean` (defaults to `true`; heap threshold e.g. `300 * 1024 * 1024`)
* `externalEndpoints?: Array<{ key: string; url: string; timeoutMs?: number }>` (uses `FetchHealthIndicator` for future integrated HTTP services/APIs)
* `customIndicators?: HealthIndicatorFunction[]` (extensible hook allowing consumer apps to inject arbitrary future checks such as queues, gRPC, S3, or third-party SDKs)


3. **Implement Custom Redis Health Indicator (`libs/nest-lib/src/health/indicators/redis.health.ts`):**
* Create an injectable `RedisHealthIndicator` using `HealthIndicatorService` (Terminus v11 API) that pings the active Redis client/store from `RedisCacheModule` (or `CACHE_MANAGER`) with a short timeout (e.g., `2000ms`).
* Return `indicator.up()` on `PONG` (or when Redis is intentionally disabled via `REDIS_ENABLED=false` with `{ status: 'up', mode: 'in-memory-fallback' }`), and `indicator.down({ message })` on connection failure.


4. **Implement Dynamic `HealthModule` & `HealthController` (`libs/nest-lib/src/health/`):**
* `libs/nest-lib/src/health/health.controller.ts`:
* Decorate with `@ApiTags('Health')` and leave undecorated by `@DynamicRateLimit()` so probes are never rate-limited.

* Expose **Liveness Probe** (`@Get()` on `/` and `@Get('health/live')`): Runs lightweight in-process checks only (e.g., `MemoryHealthIndicator.checkHeap`) so transient database/Redis blips do not trigger container restart storms.
* Expose **Readiness Probe** (`@Get('health')` and `@Get('health/ready')`): Runs `@HealthCheck()` aggregating all enabled dependency indicators (TypeORM `pingCheck('database')`, `RedisHealthIndicator.isHealthy('redis')`, configured `externalEndpoints` via `FetchHealthIndicator`, and all `customIndicators`), returning HTTP `200 OK` (`status: 'ok'`) when healthy or HTTP `503 Service Unavailable` (`status: 'error'`) if any dependency is down.


* `libs/nest-lib/src/health/health.module.ts`:
* Import `TerminusModule` (with `gracefulShutdownTimeoutMs` optional config) and expose `HealthModule.forRootAsync(options)`.
* **Edge-Case Handling:** Inject `TypeOrmHealthIndicator` with `@Optional()` so future microservices in the monorepo that do not use TypeORM can still import `HealthModule` with `enableDatabaseCheck: false` without throwing NestJS DI resolution errors.


* Export `HealthModule`, `RedisHealthIndicator`, and `HealthModuleOptions` from `libs/nest-lib/src/index.ts`.


---

## Objective 2: Integrate `HealthModule` into `apps/ikag-api` & Enable Graceful Shutdown

Wire `HealthModule.forRootAsync(...)` into `apps/ikag-api`, enable NestJS shutdown hooks for clean `shutting_down` status reporting, and update OpenTelemetry/Docker probe alignment.

### Requirements:

1. **Register `HealthModule` in `apps/ikag-api/src/app.module.ts`:**
* Replace any placeholder root health route in `apps/ikag-api/src/app.controller.ts` (to avoid duplicate `GET /` route collisions) with `HealthModule.forRootAsync(...)` configured via `ConfigService`:
* `serviceName: 'ikag-api'`
* `enableDatabaseCheck: true`
* `enableRedisCheck: configService.get('REDIS_ENABLED') !== 'false'`
* `externalEndpoints: []` (ready for future integrated services via `.env` or factory)
* `customIndicators: []` (document inline example for adding future service checks)


2. **Enable Shutdown Hooks in `apps/ikag-api/src/main.ts`:**
* Call `app.enableShutdownHooks()` so `@nestjs/terminus` intercepts `SIGTERM`/`SIGINT` and returns `status: 'shutting_down'` during rolling deployments.
* Verify `/` and `/health*` are excluded if `app.setGlobalPrefix(...)` is ever applied.


3. **Update OpenTelemetry Ignore Paths (`apps/ikag-api/src/main.ts` or `tracing.ts`):**
* Ensure `ignoreIncomingRequestPaths` includes `'/'`, `'/health'`, `'/health/live'`, and `'/health/ready'` so periodic orchestrator probes do not flood Jaeger traces.


4. **Update Environment Configs (`apps/ikag-api/.env`, `.env.dev`, `.env.example`):**
* Add optional health check tuning variables:



```env
# Health Check Configuration
HEALTH_DB_TIMEOUT_MS=3000
HEALTH_MEMORY_HEAP_MB=300

```

---

## Expected Deliverables

1. **Shared Health Library (`libs/nest-lib/src/health/`):**
* `libs/nest-lib/src/health/interfaces/health-options.interface.ts`
* `libs/nest-lib/src/health/indicators/redis.health.ts`
* `libs/nest-lib/src/health/health.controller.ts`
* `libs/nest-lib/src/health/health.module.ts`
* Updated `libs/nest-lib/src/index.ts` exporting health primitives


2. **Consumer App Integration (`apps/ikag-api/`):**
* Updated `apps/ikag-api/src/app.module.ts` importing `HealthModule.forRootAsync(...)`
* Cleaned `apps/ikag-api/src/app.controller.ts` (no conflicting `GET /` handler)
* Updated `apps/ikag-api/src/main.ts` with `app.enableShutdownHooks()` and updated OTel `ignoreIncomingRequestPaths`
* Updated `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example`


3. **Verification Checks:**
* Workspace build passing: `npx nx build nest-lib && npx nx build ikag-api`.
* Healthy state check: With `npm run infra:up` running, `GET http://localhost:3000/` returns HTTP `200` (liveness) and `GET http://localhost:3000/health` returns HTTP `200` with `database: { status: "up" }` and `redis: { status: "up" }`.
* Degraded/failure state check: Stopping Redis (`docker stop jt-redis`) causes `GET http://localhost:3000/health` to return HTTP `503 Service Unavailable` with `error.redis.status: "down"`, while `GET http://localhost:3000/` (liveness) continues returning HTTP `200`.
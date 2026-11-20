# Task: Implement Reusable OpenTelemetry Observability in `libs/nest-lib` and Provision Jaeger in Docker Compose

## Context

* **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and NestJS backend `apps/ikag-api`).
* **Existing Docker Infrastructure:** Root `/docker-compose.yml` provisions `jt-postgres` (`postgres:16-alpine`) and `jt-redis` (`redis:7-alpine`) on the `ikag-network` bridge network, with lifecycle scripts (`infra:up`, `infra:down`, `infra:logs`, `infra:reset`) in `/package.json`.
* **Target Tracing Backend:** Jaeger (`jaegertracing/jaeger:latest` or pinned `jaegertracing/jaeger:2`) exposing the Jaeger UI on port `16686` and the native OTLP/HTTP receiver on port `4318` (plus optional OTLP/gRPC on `4317`).
* **Observability Stack (Implicit Defaults):**
* `@opentelemetry/sdk-node`, `@opentelemetry/api`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, and `@opentelemetry/semantic-conventions`.
* Uses OTLP/HTTP (`http://<host>:4318/v1/traces`) to align with Jaeger's exposed `4318` port and avoid gRPC native binary issues across Windows/Alpine Docker builds.


* **Dual Execution Topology:** Supports both **Hybrid Local Dev** (`apps/ikag-api` running on host connecting to `http://localhost:4318/v1/traces`) and **Containerized App** (`npm run docker:run ikag-api` connecting via `host.docker.internal:4318` or `jaeger:4318` on `ikag-network`).
* **Environment Files:** `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example`.



---

## Objective 1: Provision Jaeger in Root `docker-compose.yml`

Add a reusable Jaeger all-in-one container to `/docker-compose.yml` so `apps/ikag-api` and all future monorepo services can export OpenTelemetry traces locally without installing Jaeger on the host OS.

### Requirements:

1. **Add `jaeger` Service to `/docker-compose.yml`:**
* Attach the service to the existing `ikag-network` bridge network alongside `postgres` and `redis`:





```yaml
  jaeger:
    image: jaegertracing/jaeger:latest
    container_name: jt-jaeger
    restart: unless-stopped
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    ports:
      - "${JAEGER_UI_PORT:-16686}:16686"
      - "${JAEGER_OTLP_HTTP_PORT:-4318}:4318"
      - "${JAEGER_OTLP_GRPC_PORT:-4317}:4317"
    networks:
      - ikag-network

```

2. **Verify Port & Network Compatibility:**
* Expose `16686:16686` for the Jaeger Web UI (`http://localhost:16686`) and `4318:4318` for OTLP/HTTP trace ingestion.
* **Edge-Case Handling:** Keep `JAEGER_UI_PORT` and `JAEGER_OTLP_HTTP_PORT` overridable via root `.env` defaults to prevent port-binding collisions on developer machines running other OTel collectors.



---

## Objective 2: Build Reusable OpenTelemetry Module & Bootstrap Helper in `libs/nest-lib`

Encapsulate OpenTelemetry SDK initialization, auto-instrumentation, and NestJS tracing utilities inside `libs/nest-lib/src/telemetry/` so any NestJS service in the monorepo can enable distributed tracing with minimal boilerplate.

### Requirements:

1. **Install OpenTelemetry Dependencies:**
* Add `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, and `@opentelemetry/semantic-conventions` to `/package.json` (and `libs/nest-lib/package.json` peer/dependencies as required by the workspace).


2. **Create Pre-Bootstrap SDK Initializer (`libs/nest-lib/src/telemetry/tracing.ts`):**
* Export an `initTelemetry(options: TelemetryOptions): NodeSDK | null` function that MUST be invoked **before** NestJS (`@nestjs/core`) or instrumented libraries (`express`, `pg`, `redis`/`ioredis`, `typeorm`) are imported.
* Accept configuration options (`libs/nest-lib/src/telemetry/interfaces/telemetry-options.interface.ts`):
* `enabled?: boolean` (defaults to `process.env.OTEL_ENABLED !== 'false'`)
* `serviceName: string` (e.g., `process.env.OTEL_SERVICE_NAME || 'ikag-api'`)
* `serviceVersion?: string` (defaults to `process.env.OTEL_SERVICE_VERSION || '1.0.0'`)
* `environment?: string` (defaults to `process.env.NODE_ENV || 'development'`)
* `otlpEndpoint?: string` (defaults to `process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'`)
* `ignoreIncomingRequestPaths?: string[]` (defaults to `['/', '/health']` so root healthcheck probes do not flood Jaeger with noise)




* Configure `NodeSDK` with:
* `resource` containing `ATTR_SERVICE_NAME`, `ATTR_SERVICE_VERSION`, and `deployment.environment`.
* `traceExporter`: `new OTLPTraceExporter({ url: otlpEndpoint })`.
* `instrumentations`: `getNodeAutoInstrumentations(...)` with `@opentelemetry/instrumentation-fs` disabled (to reduce high-volume filesystem noise) and `@opentelemetry/instrumentation-http` configured with `ignoreIncomingRequestHook` matching `ignoreIncomingRequestPaths`.


* Register `SIGTERM` and `SIGINT` process listeners to call `sdk.shutdown()` cleanly so in-flight spans flush before process termination.
* **Edge-Case Handling:** If `enabled` is `false`, return `null` immediately without initializing `NodeSDK` so unit tests or offline dev runs do not emit exporter connection errors.


3. **Create Reusable NestJS Telemetry Service & Module (`libs/nest-lib/src/telemetry/`):**
* `libs/nest-lib/src/telemetry/telemetry.service.ts`: Injectable wrapper around `@opentelemetry/api` `trace.getTracer(serviceName)` providing helper methods for custom business spans:
* `withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Attributes): Promise<T>` (automatically records exceptions via `span.recordException(err)`, sets `SpanStatusCode.ERROR`, and calls `span.end()` in `finally`).
* `getActiveTraceId(): string | undefined` (extracts current `traceId` from `trace.getActiveSpan()` for correlation in logs or HTTP error responses).


* `libs/nest-lib/src/telemetry/telemetry.module.ts`: `@Global()` module exposing `TelemetryModule.forRoot({ serviceName })` and exporting `TelemetryService`.
* Export `initTelemetry`, `TelemetryModule`, `TelemetryService`, and `TelemetryOptions` from `libs/nest-lib/src/index.ts`.



---

## Objective 3: Integrate OpenTelemetry into `apps/ikag-api` & Update Environment Configs

Wire `initTelemetry` into `apps/ikag-api`'s entry point before NestJS boots, register `TelemetryModule`, and document `.env` host mappings for both local and Dockerized execution.

### Requirements:

1. **Create Dedicated Instrumentation Entry File (`apps/ikag-api/src/instrumentation.ts`):**
* Load environment variables (`dotenv/config` or explicit `.env.dev` / `.env` loading) and immediately invoke `initTelemetry({ serviceName: process.env.OTEL_SERVICE_NAME || 'ikag-api' })` from `@jt-workspace/nest-lib`.
* Import `'./instrumentation'` as **line 1** of `apps/ikag-api/src/main.ts`—strictly above `import { NestFactory } from '@nestjs/core'` and `AppModule`.
* **Edge-Case Handling (Bundler / Webpack / TypeScript Hoisting):** Verify that `apps/ikag-api`'s build output (`dist/main.js`) preserves `./instrumentation` as the very first `require()` call before `@nestjs/core` and `pg`/`redis`; if Nest/Webpack reorders imports, use `require('./instrumentation')` at the top of `main.ts` or pass `--require ./dist/instrumentation.js` in the Node start command.


2. **Register `TelemetryModule` in `apps/ikag-api/src/app.module.ts`:**
* Import `TelemetryModule.forRoot({ serviceName: process.env.OTEL_SERVICE_NAME || 'ikag-api' })` so `TelemetryService` is globally injectable across `AuthModule` and future feature modules.


3. **Add OpenTelemetry Environment Variables (`apps/ikag-api/.env`, `.env.dev`, `.env.example`):**
* Append standardized OTel keys to all three environment files:



```env
# OpenTelemetry Observability
OTEL_ENABLED=true
OTEL_SERVICE_NAME=ikag-api
OTEL_SERVICE_VERSION=1.0.0
# Host PC dev: http://localhost:4318/v1/traces
# Dockerized app (docker-runner.js): http://host.docker.internal:4318/v1/traces
# Docker Compose network: http://jaeger:4318/v1/traces
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

```

* Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=[http://host.docker.internal:4318/v1/traces](http://host.docker.internal:4318/v1/traces)` in `apps/ikag-api/.env.dev` (matching `DB_HOST` and `REDIS_HOST` conventions for `npm run docker:run ikag-api`).



4. **Update Infrastructure Documentation (`/docs/docker-infrastructure.md`):**
* Add `jt-jaeger` (`16686` UI, `4318` OTLP/HTTP) and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to the `.env` host replacement matrix.





---

## Expected Deliverables

1. **Docker Compose Infrastructure (`/docker-compose.yml`):**
* Updated `/docker-compose.yml` containing the `jaeger` (`jt-jaeger`) service on `ikag-network` exposing `16686:16686`, `4318:4318`, and `4317:4317`.


2. **Shared Observability Library (`libs/nest-lib/src/telemetry/`):**
* `libs/nest-lib/src/telemetry/interfaces/telemetry-options.interface.ts`
* `libs/nest-lib/src/telemetry/tracing.ts` (`initTelemetry` with `NodeSDK`, OTLP/HTTP exporter, auto-instrumentations, healthcheck `/` exclusion, and graceful shutdown)
* `libs/nest-lib/src/telemetry/telemetry.service.ts` (`withSpan`, `getActiveTraceId`) and `libs/nest-lib/src/telemetry/telemetry.module.ts`
* Updated `libs/nest-lib/src/index.ts` exporting all telemetry primitives


3. **API Integration & Environment Configs (`apps/ikag-api/`):**
* `apps/ikag-api/src/instrumentation.ts` imported as line 1 of `apps/ikag-api/src/main.ts`
* Updated `apps/ikag-api/src/app.module.ts` registering `TelemetryModule.forRoot(...)`
* Updated `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, `apps/ikag-api/.env.example`, and `/docs/docker-infrastructure.md`


4. **Verification Steps:**
* Run `npm run infra:up` and confirm Jaeger UI loads at `http://localhost:16686`.
* Build and start the API (`npx nx build nest-lib && npx nx serve ikag-api`), invoke `POST /auth/login` (or `GET /docs/auth-json`), and confirm `ikag-api` appears in the Jaeger Service dropdown with HTTP, PostgreSQL (`pg`), and Redis child spans—while `GET /` produces zero trace noise.
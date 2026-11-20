# OpenTelemetry Observability Guide

This workspace provides a reusable OpenTelemetry tracing setup in `@jt-workspace/nest-lib` (`libs/nest-lib/src/telemetry/`) and a local Jaeger backend (`jt-jaeger`) in [`docker-compose.yml`](../docker-compose.yml).

---

## Architecture Overview

1. **Pre-Bootstrap Instrumentation (`@jt-workspace/nest-lib/telemetry`)**
   - `initTelemetry(options)` in [`libs/nest-lib/src/telemetry/tracing.ts`](../libs/nest-lib/src/telemetry/tracing.ts) initializes the OpenTelemetry `NodeSDK` with OTLP/HTTP export (`@opentelemetry/exporter-trace-otlp-http`) before NestJS, Express, TypeORM, `pg`, or `redis` are imported.
   - Imported via the `@jt-workspace/nest-lib/telemetry` subpath export (defined in [`libs/nest-lib/package.json`](../libs/nest-lib/package.json)) so initializing the SDK does not eagerly load NestJS/TypeORM/Redis from the main barrel.
2. **Global NestJS Module (`TelemetryModule`)**
   - [`TelemetryModule.forRoot()`](../libs/nest-lib/src/telemetry/telemetry.module.ts) is `@Global()` and exports [`TelemetryService`](../libs/nest-lib/src/telemetry/telemetry.service.ts).
   - Mounts [`TraceContextMiddleware`](../libs/nest-lib/src/telemetry/middleware/trace-context.middleware.ts) on `'{*path}'` (running before guards and `IdempotencyInterceptor`) to attach the `X-Trace-Id` response header on traced requests.
   - Registers [`TraceExceptionFilter`](../libs/nest-lib/src/telemetry/filters/trace-exception.filter.ts) as a global `APP_FILTER` to include `X-Trace-Id` headers and `traceId` in HTTP error JSON responses, and log unhandled `500` errors with `[traceId=...]`.
3. **Local Tracing Backend (`jt-jaeger`)**
   - Runs `jaegertracing/jaeger:2.23.0` on `ikag-network` in [`docker-compose.yml`](../docker-compose.yml).
   - Exposes the Jaeger Web UI on `16686`, OTLP/HTTP on `4318`, and OTLP/gRPC on `4317`.

---

## What Is Traced (and Filtered)

| Category | Status | Details |
| :--- | :--- | :--- |
| **HTTP & Routing** | Enabled | `@opentelemetry/instrumentation-http`, `express`, `router`, `nestjs-core` |
| **Database** | Enabled | `@opentelemetry/instrumentation-pg` (PostgreSQL queries & pool connections) |
| **Cache / Rate Limit** | Enabled | `@opentelemetry/instrumentation-redis` / `ioredis` |
| **Low-level Noise** | Disabled | `@opentelemetry/instrumentation-fs`, `dns`, and `net` are disabled |
| **Healthchecks** | Ignored | Exact paths `['/', '/health']` (configurable via `ignoreIncomingRequestPaths`) |
| **Swagger UI & JSON** | Ignored | Prefix `'/' + (process.env.SWAGGER_DOCS_PATH \|\| 'docs')` excludes `/docs`, `/docs/*`, and `/docs-*` |

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OTEL_ENABLED` | `true` (anything except `'false'`) | Set to `'false'` to skip `NodeSDK` startup (e.g. unit tests or offline dev) |
| `OTEL_SERVICE_NAME` | `serviceName` argument (e.g. `ikagi-api`) | Service name displayed in Jaeger |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Resource `service.version` attribute |
| `NODE_ENV` | `development` | Resource `deployment.environment` attribute |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP/HTTP collector URL |
| `SWAGGER_DOCS_PATH` | `docs` | Base Swagger path automatically excluded from HTTP tracing |

### Endpoint by Execution Mode

| Execution Mode | `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Notes |
| :--- | :--- | :--- |
| **Host PC (`yarn nx serve @org/ikagi-api`)** | `http://localhost:4318/v1/traces` | Default in `apps/ikagi-api/.env` and `.env.dev` |
| **Docker Runner (`yarn docker:run ikagi-api`)** | `http://host.docker.internal:4318/v1/traces` | Injected automatically by [`tools/scripts/docker-runner.mjs`](../tools/scripts/docker-runner.mjs) |
| **Shared Compose Network (`ikag-network`)** | `http://jaeger:4318/v1/traces` | Uses the `jaeger` Compose service name |

### Jaeger Port Overrides (Root `.env`)

If ports `16686`, `4318`, or `4317` collide with another local collector, override them in a root `.env` file:

```env
JAEGER_UI_PORT=16687
JAEGER_OTLP_HTTP_PORT=4319
JAEGER_OTLP_GRPC_PORT=4320
```

---

## Quick Start & Viewing Traces

1. **Start infrastructure (Postgres, Redis, Jaeger):**
   ```sh
   yarn infra:up
   ```
2. **Open the Jaeger UI:**
   Visit `http://localhost:16686`.
3. **Build the shared library and start `ikagi-api`:**
   ```sh
   yarn nx build @jt-workspace/nest-lib
   yarn nx serve @org/ikagi-api
   ```
4. **Trigger a traced endpoint:**
   Call any non-excluded API route (for example `POST http://localhost:3001/api/v1/auth/login`).
   - The HTTP response includes an `X-Trace-Id` header (and `traceId` in the JSON body on errors).
   - Select **`ikagi-api`** in the Jaeger **Service** dropdown (or search directly by the `X-Trace-Id` value) to inspect the HTTP, NestJS, Redis, and PostgreSQL spans.
   - `GET /` and `GET /docs/*` intentionally produce **no** traces.

---

## How to Utilize OpenTelemetry in Code

### 1. Custom Business Spans with `TelemetryService.withSpan()`

`TelemetryModule` is registered globally, so inject `TelemetryService` into any service or controller without extra module imports:

```ts
import { Injectable } from '@nestjs/common';
import { TelemetryService } from '@jt-workspace/nest-lib';

@Injectable()
export class OrdersService {
  constructor(private readonly telemetry: TelemetryService) {}

  async createOrder(userId: string, itemCount: number) {
    return this.telemetry.withSpan(
      'OrdersService.createOrder',
      async (span) => {
        span.setAttribute('order.item_count', itemCount);
        // Any thrown error is automatically recorded via span.recordException()
        // with SpanStatusCode.ERROR, and span.end() is called in finally.
        return this.processOrder(userId, itemCount);
      },
      { 'user.id': userId },
    );
  }
}
```

### 2. Correlating Logs & Metadata with `getActiveTraceId()`

You can read the active OpenTelemetry `traceId` either from an injected `TelemetryService` instance or **statically** anywhere in the call stack (as long as an active span exists):

```ts
import { TelemetryService } from '@jt-workspace/nest-lib';

// Via static helper (no DI required):
const traceId = TelemetryService.getActiveTraceId();

// Or via injected instance:
// const traceId = this.telemetry.getActiveTraceId();
```

### 3. Global Response Headers & Error Payloads (Automatic)

When `TelemetryModule.forRoot({ serviceName: '...' })` is registered in `AppModule`:

- **All traced HTTP responses** (including `2xx`, `3xx`, and `4xx`/`5xx`) automatically receive the `X-Trace-Id: <traceId>` header from `TraceContextMiddleware` and `TraceExceptionFilter`.
- **All HTTP error JSON responses** automatically preserve standard NestJS error fields and append `traceId`:
  ```json
  {
    "message": "Invalid credentials",
    "error": "Unauthorized",
    "statusCode": 401,
    "traceId": "5086e89d879d6c53dd6576d1c86290e9"
  }
  ```
- **Opting out of global hooks (optional):**
  ```ts
  TelemetryModule.forRoot({
    serviceName: 'my-service',
    enableGlobalTraceHeader: false,
    enableGlobalExceptionFilter: false,
  });
  ```

---

## Onboarding a New NestJS Service in This Monorepo

1. **Create `apps/<new-api>/src/instrumentation.ts`:**
   ```ts
   import * as dotenv from 'dotenv';
   import { existsSync } from 'node:fs';
   import { resolve } from 'node:path';
   import { initTelemetry } from '@jt-workspace/nest-lib/telemetry';

   for (const envPath of [
     resolve(process.cwd(), 'apps/<new-api>/.env.dev'),
     resolve(process.cwd(), 'apps/<new-api>/.env'),
     resolve(process.cwd(), '.env.dev'),
     resolve(process.cwd(), '.env'),
   ]) {
     if (existsSync(envPath)) {
       dotenv.config({ path: envPath });
     }
   }

   initTelemetry({
     serviceName: process.env.OTEL_SERVICE_NAME || '<new-api>',
   });
   ```
2. **Import `./instrumentation` on line 1 of `apps/<new-api>/src/main.ts`** (strictly above `@nestjs/core` and `AppModule`):
   ```ts
   import './instrumentation';
   import { NestFactory } from '@nestjs/core';
   import { AppModule } from './app/app.module';
   ```
3. **Register `TelemetryModule` in `apps/<new-api>/src/app/app.module.ts`:**
   ```ts
   import { TelemetryModule } from '@jt-workspace/nest-lib';

   @Module({
     imports: [
       // ...
       TelemetryModule.forRoot({
         serviceName: process.env.OTEL_SERVICE_NAME || '<new-api>',
       }),
     ],
   })
   export class AppModule {}
   ```
4. **Add `OTEL_*` variables** to the app's `.env` / `.env.dev` / `.env.example` files.

---

## Troubleshooting

- **Only HTTP spans appear (no `pg` or `redis` spans):** Ensure `import './instrumentation';` is the very first line of `main.ts`, and that `instrumentation.ts` imports `initTelemetry` from `@jt-workspace/nest-lib/telemetry` (not `@jt-workspace/nest-lib`), so `NodeSDK` patches `pg` and `redis` before they are loaded.
- **Traces do not appear immediately in Jaeger:** `NodeSDK` uses `BatchSpanProcessor` by default; wait ~5 seconds for the batch flush or send `SIGTERM`/`SIGINT` to trigger `sdk.shutdown()`.
- **Unit tests fail trying to reach `localhost:4318`:** Set `OTEL_ENABLED=false` in the test environment so `initTelemetry()` returns `null` immediately without creating an exporter.

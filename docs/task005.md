# Task: Configure Scoped Swagger Documentation Routes (`/docs`, `/docs/auth`, `/docs/auth-json`) and Reserve Root (`/`) for Health Checks

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace`
- **Target Application:** `apps/ikagi-api` (NestJS backend service)
- **Shared Library:** `libs/nest-lib` (provides shared `AuthModule` / `AuthController` or auth primitives)
- **Routing & Documentation Stack (Implicit Defaults):**
- `@nestjs/swagger` (`SwaggerModule`, `DocumentBuilder`) for OpenAPI 3.0 generation.
- `@nestjs/terminus` or lightweight NestJS `@Controller()` (`AppController`) for root health check handling (`GET /`).
- Assumes no global route prefix (e.g., `app.setGlobalPrefix(...)`) is set, or if configured, `/docs`, `/docs/auth`, `/docs/auth-json`, and `/` are explicitly excluded from any global prefix so they resolve at exact top-level paths.

---

## Objective 1: Reserve Root Path (`/`) for Service Health Checks

Ensure `GET /` acts exclusively as a lightweight health check endpoint for load balancers, Docker health probes, and uptime monitors without colliding with Swagger UI or redirecting unexpectedly.

### Requirements:

1. **Configure Root Health Check Endpoint (`apps/ikagi-api/src/app.controller.ts` & `apps/ikagi-api/src/app.service.ts`):**

- Implement `@Controller()` (empty path prefix) with `@Get()` returning a deterministic HTTP `200 OK` JSON payload (e.g., `{ status: 'ok', service: 'ikagi-api', timestamp: new Date().toISOString() }`).
- Decorate `AppController` with `@ApiTags('Health')` and `@ApiOperation({ summary: 'Service health check' })` so it appears cleanly in the main `/docs` OpenAPI spec.
- If `app.setGlobalPrefix(...)` is ever introduced in `apps/ikagi-api/src/main.ts`, explicitly exclude `'/'` (`{ path: '/', method: RequestMethod.GET }`).

2. **Prevent Wildcard/Static Route Collisions:**

- Verify no static file middleware (`ServeStaticModule`), catch-all wildcard controller (`@Get('*')`), or Swagger setup is mounted at `'/'`.

---

## Objective 2: Mount General Swagger UI (`/docs`) and Scoped Auth Swagger UI (`/docs/auth`, `/docs/auth-json`)

Configure dual OpenAPI document builders in `apps/ikagi-api/src/main.ts` so full API documentation lives at `/docs` while isolated authentication documentation and raw OpenAPI JSON are exposed at `/docs/auth` and `/docs/auth-json`.

### Requirements:

1. **Configure Main API Swagger Instance at `/docs` (`apps/ikagi-api/src/main.ts`):**

- Instantiate a primary `DocumentBuilder` (`ikagi-api` title, version, and `.addBearerAuth()`).
- Generate the full application OpenAPI document via `SwaggerModule.createDocument(app, mainConfig)` and mount it at `'docs'` (`SwaggerModule.setup('docs', app, mainDocument)`).

2. **Configure Scoped Auth Swagger Instance at `/docs/auth` and `/docs/auth-json` (`apps/ikagi-api/src/main.ts`):**

- Instantiate a dedicated `DocumentBuilder` for authentication endpoints (e.g., `.setTitle('Ikagi Auth API')`, `.setDescription('Authentication & OAuth endpoints')`, `.addBearerAuth()`).
- Pass `include: [AuthModule]` inside `SwaggerDocumentOptions` (`SwaggerModule.createDocument(app, authConfig, { include: [AuthModule] })`) so `/docs/auth` only renders routes owned by `AuthModule` (e.g., `/auth/login`, `/auth/google`, `/auth/facebook`, `/auth/me`) without leaking unrelated domain controllers.

- Mount the scoped document at `'docs/auth'` with explicit JSON path configuration:

```ts
SwaggerModule.setup('docs/auth', app, authDocument, {
  jsonDocumentUrl: 'docs/auth-json',
});
```

- **Edge-Case Handling (Route Precedence & Sub-Path Nesting):** Register `SwaggerModule.setup('docs/auth', ...)` **before** `SwaggerModule.setup('docs', ...)` in `apps/ikagi-api/src/main.ts` so Express/Fastify router matching evaluates the more specific `/docs/auth` and `/docs/auth-json` handlers before `/docs` static assets or middleware intercept the sub-path.

3. **Verify `AuthModule` Controller Scope (`apps/ikagi-api/src/auth/auth.module.ts` & `libs/nest-lib`):**

- Ensure all auth controllers (including any shared controllers exported from `@jt-workspace/nest-lib` or defined in `apps/ikagi-api/src/auth/auth.controller.ts`) are registered within the `AuthModule` passed to `include: [AuthModule]`, and annotated with `@ApiTags('Auth')`.

---

## Expected Deliverables

1. **Root Health Check Controller (`apps/ikagi-api/src/app.controller.ts`):**

- `GET /` handler returning HTTP `200 OK` health status JSON without conflicting with `/docs*` routes.

2. **Updated Bootstrap Configuration (`apps/ikagi-api/src/main.ts`):**

- Dual `SwaggerModule` configuration mounting `/docs/auth` (with `jsonDocumentUrl: 'docs/auth-json'` and `include: [AuthModule]`) prior to `/docs`.

3. **Endpoint Verification Checklist:**

- `curl -i http://localhost:3000/` returns `HTTP/1.1 200 OK` with health check JSON.
- `curl -I http://localhost:3000/docs` returns `HTTP/1.1 200 OK` serving the full Swagger UI.
- `curl -I http://localhost:3000/docs/auth` returns `HTTP/1.1 200 OK` serving the Auth-only Swagger UI.
- `curl -s http://localhost:3000/docs/auth-json` returns valid OpenAPI 3.0 JSON containing only `AuthModule` paths and schemas.

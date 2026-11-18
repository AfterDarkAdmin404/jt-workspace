# Task: Implement Environment-Driven Dynamic Redis Rate Limiting with Healthcheck Exemptions

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and renamed consumer API `apps/ikag-api`).

- **Existing Redis Infrastructure:** `RedisCacheModule` is already initialized in `libs/nest-lib/src/cache/` and configured in `apps/ikag-api` via `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX=ikag:`, and `REDIS_TTL`.

- **Rate Limiting Stack (Implicit Defaults):**
- `@nestjs/throttler` (`v5+` or `v6+`) backed by a Redis storage adapter (`@nest-lab/throttler-storage-redis` or a custom `ThrottlerStorage` implementation reusing the existing `ioredis` / `redis` client from `libs/nest-lib` to avoid duplicate Redis connection pools).
- Shared rate-limit wrapper placed in `libs/nest-lib/src/rate-limit/` so `apps/ikag-api` and future monorepo services inherit consistent Redis-backed throttling, `.env`-driven route rules, and healthcheck exemptions.

- **Environment Files:** `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example`.

---

## Objective 1: Configure Dynamic Rate-Limit Environment Variables in `apps/ikag-api`

Externalize global defaults, route-specific overrides, and exempt paths into `.env` files so ops and developers can tune rate limits without code changes or redeployment builds.

### Requirements:

1. **Define Environment Schema in `apps/ikag-api/.env`, `.env.dev`, and `.env.example`:**

- Append the following standardized rate-limit configuration keys:

```env
# Dynamic Rate Limiting (Redis-backed)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
RATE_LIMIT_EXEMPT_ROUTES=/,/health
# JSON map of route pattern ("METHOD:/path" or "/path") -> { "ttl": seconds, "limit": maxRequests }
RATE_LIMIT_ROUTES={"POST:/auth/login":{"ttl":60,"limit":5},"POST:/auth/google":{"ttl":60,"limit":10},"POST:/auth/facebook":{"ttl":60,"limit":10}}

```

2. **Establish Parsing & Fallback Conventions:**

- **Global Default:** Applies `RATE_LIMIT_TTL` (in seconds, defaulting to `60`) and `RATE_LIMIT_LIMIT` (defaulting to `100`) to any route not explicitly exempted or matched in `RATE_LIMIT_ROUTES`.
- **Exempt Routes:** Parse `RATE_LIMIT_EXEMPT_ROUTES` as a comma-separated list (defaulting to `/` so load-balancer and container healthchecks are never throttled).
- **Per-Route Overrides:** Parse `RATE_LIMIT_ROUTES` as a JSON object supporting exact paths (e.g., `/auth/login`), HTTP-method-scoped keys (e.g., `POST:/auth/login`), and wildcard prefixes (e.g., `/auth/*`).
- **Edge-Case Handling:** Validate `RATE_LIMIT_ROUTES` JSON at application startup; if malformed, log a clear warning via NestJS `Logger` and fall back to global defaults rather than crashing the API.

---

## Objective 2: Build Shareable Dynamic Rate-Limit Module in `libs/nest-lib`

Encapsulate Redis-backed `ThrottlerStorage`, route-level dynamic configuration resolution, and exemption guards inside `libs/nest-lib/src/rate-limit/` so any Nx app can enable throttling via `forRootAsync`.

### Requirements:

1. **Install Dependencies in `libs/nest-lib`:**

- Install `@nestjs/throttler` (and Redis storage driver if not using a custom `ThrottlerStorage` adapter over the existing Redis client).

2. **Create Rate-Limit Interfaces (`libs/nest-lib/src/rate-limit/interfaces/rate-limit-options.interface.ts`):**

- Define `RouteRateLimitRule` (`{ ttl: number; limit: number }`), `RateLimitModuleOptions` (`enabled: boolean`, `defaultTtl: number`, `defaultLimit: number`, `exemptRoutes: string[]`, `routeRules: Record<string, RouteRateLimitRule>`, `redis?: RedisConnectionOptions`), and `RateLimitAsyncOptions` (`imports`, `inject`, `useFactory`).

3. **Implement Redis `ThrottlerStorage` (`libs/nest-lib/src/rate-limit/redis-throttler.storage.ts`):**

- Implement NestJS `ThrottlerStorage` (`increment(key, ttl, limit, blockDuration, throttlerName)`) using atomic Redis `INCR` + `PEXPIRE` (or Lua script) prefixed under `${REDIS_KEY_PREFIX}throttle:` (e.g., `ikag:throttle:<tracker>:<routeKey>`).
- **Edge-Case Handling:** If `REDIS_ENABLED=false` or Redis is temporarily unreachable, fail open (allow the request and log a warning) or fall back to in-memory tracking so a cache outage never causes cascading `500` errors across the API.

4. **Implement Custom Dynamic Guard (`libs/nest-lib/src/rate-limit/dynamic-throttler.guard.ts`):**

- Extend `ThrottlerGuard` and override `canActivate` / `handleRequest`:
- **Toggle Check:** Immediately return `true` when `RATE_LIMIT_ENABLED=false`.
- **Exemption Check:** Normalize the incoming request path (stripping query strings and trailing slashes except root `/`) and immediately return `true` if it matches `exemptRoutes` (ensuring `GET /` healthchecks always bypass throttling and do not emit `X-RateLimit-*` noise or consume Redis keys).
- **Dynamic Route Lookup:** Resolve `{ ttl, limit }` in priority order:

1. Exact `METHOD:/normalized/path` match in `routeRules`
2. Exact `/normalized/path` match in `routeRules`
3. Longest matching wildcard prefix (e.g., `/auth/*`) in `routeRules`
4. Global `defaultTtl` / `defaultLimit`

- **Proxy-Aware Client IP Extraction:** Extract client IP from `X-Forwarded-For` (first hop) or `req.ip` so Docker/Nginx reverse-proxy deployments do not bucket all users under a single gateway IP.
- **Unit Normalization:** Convert `.env` `ttl` values from **seconds** to **milliseconds** (`ttl * 1000`) when passing to `@nestjs/throttler` v5+, ensuring `ttl: 60` enforces a 60-second window rather than 60ms.

5. **Create `DynamicRateLimitModule` (`libs/nest-lib/src/rate-limit/rate-limit.module.ts`) & Export:**

- Expose `DynamicRateLimitModule.forRootAsync(...)` configuring `ThrottlerModule.forRootAsync(...)` with `RedisThrottlerStorage` and registering `DynamicThrottlerGuard` as an `APP_GUARD` provider.
- Export `DynamicRateLimitModule`, `DynamicThrottlerGuard`, `RedisThrottlerStorage`, and interfaces from `libs/nest-lib/src/index.ts`.

---

## Objective 3: Integrate into `apps/ikag-api` and Verify Runtime Behavior

Wire `DynamicRateLimitModule` into `apps/ikag-api` and validate healthcheck bypasses, per-route overrides, default fallbacks, and `.env` configurability.

### Requirements:

1. **Register Module in `apps/ikag-api/src/app.module.ts`:**

- Import `DynamicRateLimitModule.forRootAsync(...)`, injecting `ConfigService` to bind `RATE_LIMIT_ENABLED`, `RATE_LIMIT_TTL`, `RATE_LIMIT_LIMIT`, `RATE_LIMIT_EXEMPT_ROUTES`, `RATE_LIMIT_ROUTES`, and existing `REDIS_*` connection settings.
- Ensure `app.set('trust proxy', 1)` is configured in `apps/ikag-api/src/main.ts` when running behind reverse proxies or Docker gateways.

2. **Optional Decorator Override Support:**

- Ensure standard `@SkipThrottle()` and `@Throttle({ default: { limit, ttl } })` decorators remain compatible if a controller needs code-level overrides on top of `.env` defaults.

3. **Execute Build & Runtime Verification:**

- Build library and API via `npx nx build nest-lib` and `npx nx build ikag-api`.
- Verify `GET /` (healthcheck) can be called repeatedly beyond `RATE_LIMIT_LIMIT` and consistently returns `HTTP 200` without `429 Too Many Requests`.
- Verify a configured route (e.g., `POST /auth/login` with `limit: 5, ttl: 60`) allows 5 requests, returns `HTTP 429` with `Retry-After` / `X-RateLimit-*` headers on the 6th request, and stores keys under `ikag:throttle:*` in Redis.
- Modify `RATE_LIMIT_ROUTES` or `RATE_LIMIT_LIMIT` in `apps/ikag-api/.env.dev`, restart the service, and confirm updated thresholds take effect without code modifications.

---

## Expected Deliverables

1. **Shared Rate-Limit Module (`libs/nest-lib/src/rate-limit/`):**

- `libs/nest-lib/src/rate-limit/interfaces/rate-limit-options.interface.ts`
- `libs/nest-lib/src/rate-limit/redis-throttler.storage.ts`
- `libs/nest-lib/src/rate-limit/dynamic-throttler.guard.ts`
- `libs/nest-lib/src/rate-limit/rate-limit.module.ts`
- Updated `libs/nest-lib/src/index.ts` exporting the rate-limit module, guard, storage, and types

2. **Consumer App & Environment Configuration (`apps/ikag-api`):**

- Updated `apps/ikag-api/src/app.module.ts` and `apps/ikag-api/src/main.ts`
- Updated `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example` containing `RATE_LIMIT_ENABLED`, `RATE_LIMIT_TTL`, `RATE_LIMIT_LIMIT`, `RATE_LIMIT_EXEMPT_ROUTES=/`, and `RATE_LIMIT_ROUTES`

3. **Verification Artifacts:**

- Clean Nx build output (`npx nx build nest-lib && npx nx build ikag-api`)
- Curl/HTTP test commands and expected responses demonstrating `/` exemption (`200 OK`), route-specific `429 Too Many Requests` enforcement, and Redis key inspection (`KEYS ikag:throttle:*`)

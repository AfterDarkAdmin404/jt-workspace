# Task: Simplify Dynamic Redis Rate Limiting to Opt-In Controller Decorators

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and consumer API `apps/ikag-api`).

- **Architectural Shift:** Remove global `APP_GUARD` registration and `RATE_LIMIT_EXEMPT_ROUTES` path-exemption logic. Rate limiting is strictly **opt-in at the controller or route level** via custom decorators (`@DynamicRateLimit()`), meaning undecorated controllers (such as healthchecks on `/`) remain completely unthrottled by default.
- **Existing Redis & Throttler Stack:**
- `RedisCacheModule` is already configured in `libs/nest-lib/src/cache/` using `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX=ikag:`, and `REDIS_TTL`.

- `@nestjs/throttler` (`v5+` / `v6+`) backed by `RedisThrottlerStorage` in `libs/nest-lib/src/rate-limit/`.

- **Environment Files:** `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example`.

---

## Objective 1: Simplify `.env` Configuration for Default and Named Rate-Limit Profiles

Update the environment schema in `apps/ikag-api` to drop route-exemption lists and instead define a global default fallback alongside named dynamic profiles adjustable in `.env` at any time.

### Requirements:

1. **Update Environment Variables in `apps/ikag-api/.env`, `.env.dev`, and `.env.example`:**

- Replace previous exemption/path-based variables with clean default and named-profile keys:

```env
# Dynamic Opt-In Rate Limiting (Redis-backed)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_TTL=60
RATE_LIMIT_DEFAULT_LIMIT=100
# JSON map of named profiles -> { "ttl": seconds, "limit": maxRequests }
RATE_LIMIT_PROFILES={"auth":{"ttl":60,"limit":5},"oauth":{"ttl":60,"limit":10},"strict":{"ttl":60,"limit":3}}

```

2. **Define Profile Resolution Rules:**

- **Default Tier (`@DynamicRateLimit()` with no arguments):** Uses `RATE_LIMIT_DEFAULT_TTL` (default `60` seconds) and `RATE_LIMIT_DEFAULT_LIMIT` (default `100` requests).
- **Defined Named Profiles (`@DynamicRateLimit('auth')`):** Looks up the matching key in `RATE_LIMIT_PROFILES` from `.env`; if the key is missing or `RATE_LIMIT_PROFILES` is malformed JSON, log a startup/runtime warning and fall back cleanly to `RATE_LIMIT_DEFAULT_TTL` and `RATE_LIMIT_DEFAULT_LIMIT`.
- **Inline Override Support (`@DynamicRateLimit({ ttl: 30, limit: 10 })`):** Allow optional direct object overrides when a specific controller requires static code-level bounds.

---

## Objective 2: Refactor `libs/nest-lib/src/rate-limit/` for Opt-In Decorator Usage

Remove global `APP_GUARD` binding and path-matching exemption logic from `libs/nest-lib`, replacing them with a self-contained `@DynamicRateLimit()` decorator and `DynamicThrottlerGuard`.

### Requirements:

1. **Create `@DynamicRateLimit()` Decorator (`libs/nest-lib/src/rate-limit/decorators/dynamic-rate-limit.decorator.ts`):**

- Accept optional argument `profileOrOptions?: string | { ttl: number; limit: number }`.
- Store metadata key `RATE_LIMIT_PROFILE_KEY` via `SetMetadata` and compose `@UseGuards(DynamicThrottlerGuard)` inside `applyDecorators(...)` so applying `@DynamicRateLimit()` or `@DynamicRateLimit('auth')` on a `@Controller(...)` (or individual method) automatically attaches the guard and profile metadata in a single decorator.

2. **Update Interfaces (`libs/nest-lib/src/rate-limit/interfaces/rate-limit-options.interface.ts`):**

- Remove `exemptRoutes` and path-matching route maps.
- Define `RateLimitRule` (`{ ttl: number; limit: number }`), `RateLimitModuleOptions` (`enabled: boolean`, `defaultTtl: number`, `defaultLimit: number`, `profiles: Record<string, RateLimitRule>`, `redis?: RedisConnectionOptions`), and `RateLimitAsyncOptions`.

3. **Simplify `DynamicThrottlerGuard` (`libs/nest-lib/src/rate-limit/dynamic-throttler.guard.ts`):**

- Remove `APP_GUARD` root registration and URL normalization / `exemptRoutes` bypass logic.
- Read `RATE_LIMIT_PROFILE_KEY` metadata from `Reflector` (`getAllAndOverride` across handler and controller class):
- If `RATE_LIMIT_ENABLED=false` or no `@DynamicRateLimit` metadata is present, return `true` immediately.
- If metadata is a string (e.g., `'auth'`), resolve `{ ttl, limit }` from `options.profiles['auth']`, falling back to `{ defaultTtl, defaultLimit }`.
- If metadata is omitted/undefined (bare `@DynamicRateLimit()`), use `{ defaultTtl, defaultLimit }`.
- Convert `ttl` from **seconds** to **milliseconds** (`ttl * 1000`) for `@nestjs/throttler` v5+, and scope Redis keys by controller/route handler + client IP (`ikag:throttle:<profile>:<controller>:<ip>`).

4. **Update `DynamicRateLimitModule` (`libs/nest-lib/src/rate-limit/rate-limit.module.ts`) & Exports:**

- Remove `{ provide: APP_GUARD, useClass: DynamicThrottlerGuard }` from `forRootAsync(...)`; export `DynamicThrottlerGuard`, `RedisThrottlerStorage`, and `RATE_LIMIT_OPTIONS` so decorated controllers across any module can resolve the guard cleanly.
- Export `@DynamicRateLimit` decorator alongside module, guard, storage, and interfaces in `libs/nest-lib/src/index.ts`.

---

## Objective 3: Apply Opt-In Decorators in `apps/ikag-api` and Verify Behavior

Wire the simplified `DynamicRateLimitModule` into `apps/ikag-api`, apply `@DynamicRateLimit(...)` selectively to target controllers, and verify that undecorated controllers remain completely untouched.

### Requirements:

1. **Update `apps/ikag-api/src/app.module.ts`:**

- Configure `DynamicRateLimitModule.forRootAsync(...)` binding `RATE_LIMIT_ENABLED`, `RATE_LIMIT_DEFAULT_TTL`, `RATE_LIMIT_DEFAULT_LIMIT`, `RATE_LIMIT_PROFILES`, and existing `REDIS_*` credentials via `ConfigService`.

2. **Decorate Target Controllers Selectively:**

- Leave `AppController` (`GET /` healthcheck) **undecorated** so zero rate-limit checks, Redis calls, or `X-RateLimit-*` headers execute on `/`.
- Apply `@DynamicRateLimit('auth')` to `apps/ikag-api/src/auth/auth.controller.ts` (or `@DynamicRateLimit()` for default limits on general feature controllers).

3. **Build & Verify Runtime Behavior:**

- Run `npx nx build nest-lib && npx nx build ikag-api` to verify clean compilation.
- Confirm `GET /` executes with zero Redis throttle keys created and never returns `429`.
- Confirm `POST /auth/login` enforces the `auth` profile (`limit: 5, ttl: 60` from `.env`), returns `HTTP 429` on the 6th call, and dynamically reflects changes when `RATE_LIMIT_PROFILES` or `RATE_LIMIT_DEFAULT_LIMIT` is edited in `apps/ikag-api/.env.dev` and restarted.

---

## Expected Deliverables

1. **Simplified Rate-Limit Library (`libs/nest-lib/src/rate-limit/`):**

- `libs/nest-lib/src/rate-limit/decorators/dynamic-rate-limit.decorator.ts` (`@DynamicRateLimit(profileOrOptions?)`)
- Updated `libs/nest-lib/src/rate-limit/interfaces/rate-limit-options.interface.ts`
- Updated `libs/nest-lib/src/rate-limit/dynamic-throttler.guard.ts` (controller/handler-scoped, no root `APP_GUARD` or path exemptions)
- Updated `libs/nest-lib/src/rate-limit/rate-limit.module.ts` and `libs/nest-lib/src/index.ts`

2. **Consumer App & `.env` Updates (`apps/ikag-api`):**

- Updated `apps/ikag-api/.env`, `apps/ikag-api/.env.dev`, and `apps/ikag-api/.env.example` with `RATE_LIMIT_ENABLED`, `RATE_LIMIT_DEFAULT_TTL`, `RATE_LIMIT_DEFAULT_LIMIT`, and `RATE_LIMIT_PROFILES`
- Updated `apps/ikag-api/src/app.module.ts` and decorated `apps/ikag-api/src/auth/auth.controller.ts` (`@DynamicRateLimit('auth')`), with `AppController` (`/`) left undecorated

3. **Verification Artifacts:**

- Passing build output (`npx nx build nest-lib && npx nx build ikag-api`)
- Test verification showing `/` produces no `ikag:throttle:*` Redis keys while `@DynamicRateLimit('auth')` enforces `.env`-configured limits and updates dynamically on `.env` change

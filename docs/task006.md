# Task: Configure Husky & Conventional Commits Enforcement and Initialize Environment-Driven Redis Caching

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (Node/TypeScript monorepo with shared library `libs/nest-lib` and consumer API `apps/ikagi-api`).
- **Git & Commit Tooling (Implicit Defaults):**
- `husky` (v9+ flat hook format in `.husky/commit-msg` and `.husky/pre-commit`) configured at the workspace root `/package.json`.
- `@commitlint/cli` and `@commitlint/config-conventional` configured via `/commitlint.config.js` (or `.mjs`) enforcing Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `revert`).

- **Cache & NestJS Stack (Implicit Defaults):**
- Redis server (`redis:7-alpine` in Docker or local instance at `localhost:6379`).
- `@nestjs/cache-manager` (v2/v3), `cache-manager`, and `cache-manager-redis-yet` (or `@keyv/redis` depending on installed `cache-manager` major version—verify `package.json` compatibility before installing).
- Shared cache wrapper module placed in `libs/nest-lib/src/cache/` so `apps/ikagi-api` and future monorepo apps share consistent Redis configuration, key prefixing, and TTL defaults.

- **Environment Files:**
- `apps/ikagi-api/.env` (CLI / migration environment) and `apps/ikagi-api/.env.dev` (runtime & Docker `--env-file` environment).

---

## Objective 1: Initialize Husky and Standardize Commit Messages via Commitlint

Establish automated Git hooks at the monorepo root so every commit is validated against the Conventional Commits specification before entering history.

### Requirements:

1. **Install Dev Dependencies at Workspace Root:**

- Install `husky`, `@commitlint/cli`, and `@commitlint/config-conventional` in `/package.json` (`devDependencies`).
- Add `"prepare": "husky"` to root `/package.json` `scripts` so hooks auto-initialize on `install` across developer machines.

2. **Initialize Husky & Configure Git Hooks:**

- Run `npx husky init` at `D:\Development\Projects\jt-workspace` to generate `/.husky/`.
- Replace the default `/.husky/pre-commit` script with workspace linting/typecheck validation (e.g., `npm run build --workspace=libs/nest-lib` or `npx lint-staged` if configured; remove default `npm test` if no test runner exists yet so valid commits are not blocked).
- Create `/.husky/commit-msg` executing `npx --no -- commitlint --edit "$1"`.

3. **Create Commitlint Configuration (`/commitlint.config.js`):**

- Extend `@commitlint/config-conventional` and define explicit workspace scopes matching the monorepo layout:
- `scopes`: `['workspace', 'nest-lib', 'ikagi-api', 'auth', 'audit', 'cache', 'docker', 'deps']`
- `scope-enum`: `[1, 'always', ['workspace', 'nest-lib', 'ikagi-api', 'auth', 'audit', 'cache', 'docker', 'deps']]` (warn on custom scopes while enforcing standard types `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`).

- **Edge-Case Handling:** Ensure LF line endings (`*.sh text eol=lf` in `/.gitattributes`) for files inside `/.husky/` so Windows CRLF conversions on `D:\Development\Projects\jt-workspace` do not break POSIX hook execution in Git Bash / WSL.

---

## Objective 2: Configure Redis Environment Variables in `apps/ikagi-api`

Externalize all Redis connection, authentication, key-prefix, and TTL parameters into environment files so local, Docker, and production deployments require zero code changes.

### Requirements:

1. **Update `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev`:**

- Append standardized Redis configuration keys to both `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev`:

```env
# Redis Cache Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=ikagi:
REDIS_TTL=300

```

- **Edge-Case Handling:** When running `apps/ikagi-api` inside Docker via `scripts/docker-runner.js` (which passes `--add-host=host.docker.internal:host-gateway` and `--env-file apps/ikagi-api/.env.dev`), document or set `REDIS_HOST=host.docker.internal` (or service name `redis` when using Compose) in `apps/ikagi-api/.env.dev` if Redis runs on the host machine rather than inside the same container.

2. **Create Environment Template (`apps/ikagi-api/.env.example`):**

- Mirror all Database, JWT, OAuth, Swagger, and `REDIS_*` keys with safe placeholder defaults so new contributors have a complete reference.

---

## Objective 3: Build Shareable Redis Cache Module in `libs/nest-lib` & Integrate into `apps/ikagi-api`

Encapsulate Redis connection setup, serialization, and cache helper methods inside `libs/nest-lib` and register it globally in `apps/ikagi-api`.

### Requirements:

1. **Install Cache & Redis Packages:**

- Install `@nestjs/cache-manager`, `cache-manager`, and `cache-manager-redis-yet` (plus `redis`) in `libs/nest-lib/package.json` (and peer/root dependencies as required by the monorepo workspace).

2. **Create Shared Cache Module (`libs/nest-lib/src/cache/`):**

- `libs/nest-lib/src/cache/interfaces/redis-cache-options.interface.ts`: Define `RedisCacheModuleOptions` (`enabled?: boolean`, `host: string`, `port: number`, `username?: string`, `password?: string`, `db?: number`, `keyPrefix?: string`, `ttl?: number`) and `RedisCacheAsyncOptions` (`imports`, `inject`, `useFactory`).
- `libs/nest-lib/src/cache/redis-cache.service.ts`: Create an injectable `RedisCacheService` wrapping Nest's `CACHE_MANAGER` with typed helper methods (`get<T>(key: string)`, `set<T>(key: string, value: T, ttlSeconds?: number)`, `del(key: string)`, `getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number)`, and `reset()`), automatically applying `keyPrefix` if the underlying store does not natively prefix keys.
- `libs/nest-lib/src/cache/redis-cache.module.ts`: Implement `@Global() @Module({}) export class RedisCacheModule` with `static forRootAsync(options: RedisCacheAsyncOptions): DynamicModule`:
- Register `CacheModule.registerAsync(...)` using `redisStore` from `cache-manager-redis-yet` when `REDIS_ENABLED !== 'false'`, falling back gracefully to in-memory `cache-manager` store when `REDIS_ENABLED=false` (preventing local/CI crashes when Redis is intentionally disabled).
- Attach a Redis client `error` event listener logging connection failures via NestJS `Logger` without crashing the Node.js process on transient Redis disconnects.

- Export `RedisCacheModule`, `RedisCacheService`, and interfaces from `libs/nest-lib/src/index.ts`.

3. **Register in `apps/ikagi-api/src/app.module.ts`:**

- Import `RedisCacheModule.forRootAsync(...)` in `apps/ikagi-api/src/app.module.ts`, injecting `ConfigService` to bind `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`, and `REDIS_TTL` (parsing `REDIS_PORT` and `REDIS_TTL` as integers with defaults `6379` and `300`).

- **Edge-Case Handling:** Note TTL unit differences across `cache-manager` versions (`cache-manager` v5+ expects `ttl` in **milliseconds**, whereas `REDIS_TTL=300` in `.env` is configured in **seconds**); multiply `Number(configService.get('REDIS_TTL', 300)) * 1000` inside `forRootAsync` so cache entries do not expire in 300ms.

---

## Expected Deliverables

1. **Git Hooks & Commitlint Configuration (Workspace Root):**

- Updated `/package.json` with `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, and `"prepare": "husky"`
- `/.husky/commit-msg`, `/.husky/pre-commit`, and `/.gitattributes` (enforcing `eol=lf` for `.husky/*`)
- `/commitlint.config.js` enforcing Conventional Commits and workspace scopes

2. **Environment Configuration (`apps/ikagi-api`):**

- Updated `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev` containing `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`, and `REDIS_TTL`

- `apps/ikagi-api/.env.example` documenting all required environment variables

3. **Shared Redis Cache Library (`libs/nest-lib`) & App Integration (`apps/ikagi-api`):**

- `libs/nest-lib/src/cache/interfaces/redis-cache-options.interface.ts`
- `libs/nest-lib/src/cache/redis-cache.service.ts`
- `libs/nest-lib/src/cache/redis-cache.module.ts`
- Updated `libs/nest-lib/src/index.ts` exporting `RedisCacheModule`, `RedisCacheService`, and types

- Updated `apps/ikagi-api/src/app.module.ts` registering `RedisCacheModule.forRootAsync(...)` via `ConfigService`

4. **Verification Commands:**

- Commitlint check: `echo "invalid commit message" | npx commitlint` (must exit non-zero) and `echo "feat(cache): initialize redis cache module" | npx commitlint` (must exit `0`).
- Workspace build check: `npm --workspace=libs/nest-lib run build && npm --workspace=apps/ikagi-api run build`.

- Redis connectivity check: Start Redis (`docker run -d --name jt-redis -p 6379:6379 redis:7-alpine`), boot `ikagi-api`, and verify keys appear under `ikagi:*` via `docker exec -it jt-redis redis-cli KEYS "ikagi:*"`.

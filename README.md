# jt-workspace

Nx monorepo managed with **Yarn 4 (Berry)** containing:

| Project          | Package Name             | Description                                                                         |
| :--------------- | :----------------------- | :---------------------------------------------------------------------------------- |
| `apps/ikagi-api` | `@org/ikagi-api`         | NestJS backend API (Auth, Audit Logs, Redis Cache & Rate Limiting, Swagger)         |
| `apps/ikagi-web` | `@org/ikagi-web`         | Next.js frontend application                                                        |
| `libs/nest-lib`  | `@jt-workspace/nest-lib` | Shared NestJS library (TypeORM entities/migrations, Auth, Audit, Cache, Rate Limit) |
| `libs/next-lib`  | `@org/next-lib`          | Shared Next.js/React library                                                        |

---

## Prerequisites & Required Services

1. **Node.js 24+** with Corepack enabled:
   ```sh
   corepack enable
   ```
2. **PostgreSQL 16, Redis 7 & Jaeger 2 (via Docker Compose):**
   - Managed via [`docker-compose.yml`](./docker-compose.yml) (`jt-postgres` on `localhost:5433`, `db_ikag`, `postgres`/`root`, `jt-redis` on `localhost:6379`, and `jt-jaeger` UI on `localhost:16686`).
   - See [docker-infrastructure.md](./docker-infrastructure.md) for lifecycle scripts (`infra:down`, `infra:logs`, `infra:reset`), `.env` host replacement rules, and troubleshooting.
3. **Docker** _(required for `infra:up` and containerized builds/runs)_

---

## Getting Started

### 1. Install Dependencies

```sh
yarn install
```

### 2. Start Infrastructure First (Docker Compose)

PostgreSQL and Redis must be running before running migrations or starting `ikagi-api`:

```sh
yarn infra:up
docker compose ps
```

Confirm both `jt-postgres` and `jt-redis` report `(healthy)`.

### 3. Configure Environment Files (`apps/ikagi-api`)

Copy the example templates if `.env` / `.env.dev` are not already present:

- [`apps/ikagi-api/.env`](apps/ikagi-api/.env) — used by TypeORM CLI migrations (copy from [`apps/ikagi-api/.env.example`](apps/ikagi-api/.env.example))
- [`apps/ikagi-api/.env.dev`](apps/ikagi-api/.env.dev) — used by NestJS runtime and Docker `--env-file` (copy from [`apps/ikagi-api/.env.dev.example`](apps/ikagi-api/.env.dev.example))

### 4. Build Shared Library & Run Database Migrations

```sh
yarn --cwd libs/nest-lib build
yarn migration:run ikagi-api
```

Check migration status at any time:

```sh
yarn migration:show ikagi-api
```

---

## Running the App

### Local Development (`ikagi-api`)

```sh
yarn nx serve @org/ikagi-api
```

Once running on `http://localhost:3000`:

- **Health Checks:** `GET /` and `GET /health/live` (liveness), `GET /health` and `GET /health/ready` (readiness) — see [healthcheck.md](./healthcheck.md)
- **Observability (OpenTelemetry & Jaeger):** Pre-bootstrap OTLP/HTTP tracing (`http://localhost:16686`) and global `X-Trace-Id` / `traceId` propagation — see [opentelemetry.md](./opentelemetry.md)
- **Full API Swagger UI:** `http://localhost:3000/docs` (OpenAPI JSON: `http://localhost:3000/docs-json`)
- **Per-Service Swagger Docs (auto-discovered):** `/docs/<service>` and `/docs/<service>-json` (for example, `http://localhost:3000/docs/auth` and `http://localhost:3000/docs/auth-json`). Any new feature module with a routed controller is automatically exposed under `/docs/<service>` via `setupSwagger` in `@jt-workspace/nest-lib` (or customized with `@SwaggerService({ name, title, description })`).
- **Auth Endpoints:** `/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/facebook`, `/api/auth/logout`, `/api/auth/change-password`, `/api/auth/me`

### Build & Typecheck

```sh
yarn nx run-many -t build typecheck
```

### Docker (`ikagi-api`)

`apps/ikagi-api/Dockerfile` builds `@jt-workspace/nest-lib` and `@org/ikagi-api`:

```sh
yarn docker:build ikagi-api
yarn docker:run ikagi-api
yarn docker:logs ikagi-api
yarn docker:stop ikagi-api
```

> **Note:** `yarn docker:run ikagi-api` defaults `DB_HOST=host.docker.internal` and `REDIS_HOST=host.docker.internal` so the container can reach PostgreSQL and Redis running on your host machine.

### CI/CD & GCP Release

- Main CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- `ikagi-api` Release (Dry-Run / GCP Cloud Run): [`.github/workflows/ikagi-api-release.yml`](.github/workflows/ikagi-api-release.yml) — see [docs/ci-cd-gcp.md](docs/ci-cd-gcp.md) for activation variables and secrets.

---

## Database Migration Commands

**From workspace root:**

```sh
yarn migration:create ikagi-api <MigrationName>
yarn migration:generate ikagi-api <MigrationName>
yarn migration:run ikagi-api
yarn migration:revert ikagi-api
yarn migration:show ikagi-api
```

**From `apps/ikagi-api`:**

```sh
yarn --cwd apps/ikagi-api migration:run
yarn --cwd apps/ikagi-api migration:revert
yarn --cwd apps/ikagi-api migration:show
```

---

## Git Hooks & Conventional Commits

Husky and Commitlint enforce:

- **Pre-commit:** `yarn nx run-many -t typecheck`
- **Commit message:** `<type>(<optional-scope>): <description>`
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`
  - Scopes: `workspace`, `nest-lib`, `ikagi-api`, `auth`, `audit`, `cache`, `docker`, `deps`
  - Example: `feat(auth): add Google OAuth2 login`

# jt-workspace

Nx monorepo managed with **Yarn 4 (Berry)** containing:

| Project | Package Name | Description |
| :--- | :--- | :--- |
| `apps/ikagi-api` | `@org/ikagi-api` | NestJS backend API (Auth, Audit Logs, Redis Cache & Rate Limiting, Swagger) |
| `apps/ikagi-web` | `@org/ikagi-web` | Next.js frontend application |
| `libs/nest-lib` | `@jt-workspace/nest-lib` | Shared NestJS library (TypeORM entities/migrations, Auth, Audit, Cache, Rate Limit) |
| `libs/next-lib` | `@org/next-lib` | Shared Next.js/React library |

---

## Prerequisites & Required Services

1. **Node.js 24+** with Corepack enabled:
   ```sh
   corepack enable
   ```
2. **PostgreSQL 14+** (required for `ikagi-api` and TypeORM migrations):
   - Default dev database: `db_ikag` on `localhost:5432` (`postgres` / `root`)
   - Quick start via Docker:
     ```sh
     docker run -d --name jt-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=root -e POSTGRES_DB=db_ikag -p 5432:5432 postgres:16-alpine
     ```
3. **Redis 7+** (used by `RedisCacheModule` and `DynamicRateLimitModule`; fails open / falls back when disabled or unreachable):
   - Quick start via Docker:
     ```sh
     docker run -d --name jt-redis -p 6379:6379 redis:7-alpine
     ```
4. **Docker** *(optional, for containerized builds/runs)*

---

## Getting Started

### 1. Install Dependencies

```sh
yarn install
```

### 2. Configure Environment Files (`apps/ikagi-api`)

Copy the example templates if `.env` / `.env.dev` are not already present:

- [`apps/ikagi-api/.env`](apps/ikagi-api/.env) — used by TypeORM CLI migrations (copy from [`apps/ikagi-api/.env.example`](apps/ikagi-api/.env.example))
- [`apps/ikagi-api/.env.dev`](apps/ikagi-api/.env.dev) — used by NestJS runtime and Docker `--env-file` (copy from [`apps/ikagi-api/.env.dev.example`](apps/ikagi-api/.env.dev.example))

### 3. Build Shared Library & Run Database Migrations

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

- **Health Check:** `GET http://localhost:3000/`
- **Full API Swagger UI:** `http://localhost:3000/docs`
- **Auth-Only Swagger UI:** `http://localhost:3000/docs/auth`
- **Auth OpenAPI JSON:** `http://localhost:3000/docs/auth-json`
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

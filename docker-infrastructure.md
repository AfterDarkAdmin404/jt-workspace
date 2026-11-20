# Docker Infrastructure & `.env` Host Migration Guide

This workspace provisions **PostgreSQL 16** (`jt-postgres`), **Redis 7** (`jt-redis`), and **Jaeger 2** (`jt-jaeger`) via root [`docker-compose.yml`](./docker-compose.yml) so developers do not need local OS-level database, cache, or tracing backend installations.

---

## Quick Start

1. **Start PostgreSQL, Redis, and Jaeger:**
   ```sh
   yarn infra:up
   ```
2. **Verify container health & UI:**
   ```sh
   docker compose ps
   ```
   Both `jt-postgres` and `jt-redis` should report `(healthy)`, and `jt-jaeger` exposes the Jaeger UI at `http://localhost:16686` and OTLP receivers on `4318` (HTTP) and `4317` (gRPC).
3. **Run TypeORM migrations (from host):**
   ```sh
   yarn --cwd libs/nest-lib build
   yarn migration:run ikagi-api
   ```
4. **Start `ikagi-api` locally:**
   ```sh
   yarn nx serve @org/ikagi-api
   ```

### Lifecycle Commands

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `yarn infra:up` | `docker compose up -d` | Start PostgreSQL and Redis in background |
| `yarn infra:down` | `docker compose down` | Stop and remove containers (volumes preserved) |
| `yarn infra:logs` | `docker compose logs -f` | Tail container logs |
| `yarn infra:reset` | `docker compose down -v` | Stop containers and **delete** `postgres_data` / `redis_data` volumes |

---

## Dual Execution Modes & `.env` Host Replacement Matrix

### Mode A — Hybrid Local Dev (Recommended for Active Coding)
- **Postgres, Redis & Jaeger:** Run in Docker Compose (`yarn infra:up`), publishing `5433:5432` (Postgres), `6379:6379` (Redis), `16686:16686` (Jaeger UI), `4318:4318` (OTLP/HTTP), and `4317:4317` (OTLP/gRPC) to the host loopback interface.
- **App & Migrations:** Run directly on the host PC (`yarn nx serve @org/ikagi-api`, `yarn migration:run ikagi-api`).
- **Host values:** `DB_HOST=localhost`, `REDIS_HOST=localhost`, and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces` in `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev`.

### Mode B — Containerized App (`yarn docker:run ikagi-api`)
- **App:** Runs inside a Docker container via [`tools/scripts/docker-runner.mjs`](./tools/scripts/docker-runner.mjs), which mounts `--env-file apps/ikagi-api/.env.dev` and passes `--add-host=host.docker.internal:host-gateway` plus `-e DB_HOST=host.docker.internal`, `-e REDIS_HOST=host.docker.internal`, and `-e OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://host.docker.internal:4318/v1/traces`.
- **Shared Compose Network Alternative:** If you attach the app container directly to `--network jt-workspace_ikag-network`, use Compose service names `postgres`, `redis`, and `http://jaeger:4318/v1/traces` instead of `host.docker.internal`.

### `.env` Variable Replacement Matrix

| Variable Key | Legacy Localhost Value | Docker Compose (App on Host PC) | Docker Compose (App in Docker via `docker-runner.mjs`) | Docker Compose (Shared Compose Network) |
| :--- | :--- | :--- | :--- | :--- |
| `DB_HOST` | `localhost` | `localhost` | `host.docker.internal` | `postgres` |
| `DB_PORT` | `5432` | `5433` | `5433` | `5432` |
| `DB_USERNAME` | `postgres` | `postgres` | `postgres` | `postgres` |
| `DB_PASSWORD` | `root` | `root` | `root` | `root` |
| `DB_NAME` | `db_ikag` | `db_ikag` | `db_ikag` | `db_ikag` |
| `REDIS_HOST` | `localhost` | `localhost` | `host.docker.internal` | `redis` |
| `REDIS_PORT` | `6379` | `6379` | `6379` | `6379` |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | `http://localhost:4318/v1/traces` | `http://host.docker.internal:4318/v1/traces` | `http://jaeger:4318/v1/traces` |

> **Note:** If you use a single `DATABASE_URL` connection string instead of discrete `DB_*` keys, replace `postgresql://postgres:root@localhost:5432/db_ikag` with `postgresql://postgres:root@host.docker.internal:5432/db_ikag` (Docker runner) or `postgresql://postgres:root@postgres:5432/db_ikag` (shared Compose network).

---

## Persistence & Troubleshooting

### Volume Persistence
- `postgres_data` is mounted to `/var/lib/postgresql/data`
- `redis_data` is mounted to `/data` (with `--appendonly yes` AOF persistence)
- Data survives `yarn infra:down` and container restarts. Only `yarn infra:reset` (`docker compose down -v`) deletes the volumes.

### Port Collisions (`5433`, `6379`, `16686`, `4318`, or `4317` Already in Use)
If a local PostgreSQL, Redis, or OpenTelemetry/Jaeger service is already running on your OS, `yarn infra:up` will fail with `address already in use`. Either:
1. Stop the local OS service (e.g., Windows Services `postgresql-x64-*` / `Redis`), **or**
2. Override the published host ports in a root `.env` file:
   ```env
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   JAEGER_UI_PORT=16687
   JAEGER_OTLP_HTTP_PORT=4319
   JAEGER_OTLP_GRPC_PORT=4320
   ```
   (And update `DB_PORT`, `REDIS_PORT`, and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` in `apps/ikagi-api/.env` and `.env.dev` to match.)

### Windows / WSL2 / macOS Networking Notes
- **Docker Desktop (Windows / macOS):** `host.docker.internal` is provided natively and reinforced by `--add-host=host.docker.internal:host-gateway` in `tools/scripts/docker-runner.mjs`.
- **Linux / WSL2 without Docker Desktop:** Ensure Docker Engine `>= 20.10` is used so `host-gateway` resolves `host.docker.internal`, or attach the container to `jt-workspace_ikag-network` and set `DB_HOST=postgres` and `REDIS_HOST=redis`.

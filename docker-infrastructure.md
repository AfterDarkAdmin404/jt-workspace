# Docker Infrastructure & `.env` Host Migration Guide

This workspace provisions **PostgreSQL 16** (`jt-postgres`) and **Redis 7** (`jt-redis`) via root [`docker-compose.yml`](../docker-compose.yml) so developers do not need local OS-level database or cache installations.

---

## Quick Start

1. **Start PostgreSQL and Redis:**
   ```sh
   yarn infra:up
   ```
2. **Verify container health:**
   ```sh
   docker compose ps
   ```
   Both `jt-postgres` and `jt-redis` should report `(healthy)`.
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
- **Postgres & Redis:** Run in Docker Compose (`yarn infra:up`), publishing `5432:5432` and `6379:6379` to the host loopback interface.
- **App & Migrations:** Run directly on the host PC (`yarn nx serve @org/ikagi-api`, `yarn migration:run ikagi-api`).
- **Host values:** `DB_HOST=localhost` and `REDIS_HOST=localhost` in `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev`.

### Mode B — Containerized App (`yarn docker:run ikagi-api`)
- **App:** Runs inside a Docker container via [`tools/scripts/docker-runner.mjs`](../tools/scripts/docker-runner.mjs), which mounts `--env-file apps/ikagi-api/.env.dev` and passes `--add-host=host.docker.internal:host-gateway` plus `-e DB_HOST=host.docker.internal` and `-e REDIS_HOST=host.docker.internal`.
- **Shared Compose Network Alternative:** If you attach the app container directly to `--network jt-workspace_ikag-network`, use Compose service names `postgres` and `redis` instead of `host.docker.internal`.

### `.env` Variable Replacement Matrix

| Variable Key | Legacy Localhost Value | Docker Compose (App on Host PC) | Docker Compose (App in Docker via `docker-runner.mjs`) | Docker Compose (Shared Compose Network) |
| :--- | :--- | :--- | :--- | :--- |
| `DB_HOST` | `localhost` | `localhost` | `host.docker.internal` | `postgres` |
| `DB_PORT` | `5432` | `5432` | `5432` | `5432` |
| `DB_USERNAME` | `postgres` | `postgres` | `postgres` | `postgres` |
| `DB_PASSWORD` | `root` | `root` | `root` | `root` |
| `DB_NAME` | `db_ikag` | `db_ikag` | `db_ikag` | `db_ikag` |
| `REDIS_HOST` | `localhost` | `localhost` | `host.docker.internal` | `redis` |
| `REDIS_PORT` | `6379` | `6379` | `6379` | `6379` |

> **Note:** If you use a single `DATABASE_URL` connection string instead of discrete `DB_*` keys, replace `postgresql://postgres:root@localhost:5432/db_ikag` with `postgresql://postgres:root@host.docker.internal:5432/db_ikag` (Docker runner) or `postgresql://postgres:root@postgres:5432/db_ikag` (shared Compose network).

---

## Persistence & Troubleshooting

### Volume Persistence
- `postgres_data` is mounted to `/var/lib/postgresql/data`
- `redis_data` is mounted to `/data` (with `--appendonly yes` AOF persistence)
- Data survives `yarn infra:down` and container restarts. Only `yarn infra:reset` (`docker compose down -v`) deletes the volumes.

### Port Collisions (`5432` or `6379` Already in Use)
If a local PostgreSQL or Redis service is already running on your OS, `yarn infra:up` will fail with `address already in use`. Either:
1. Stop the local OS service (e.g., Windows Services `postgresql-x64-*` / `Redis`), **or**
2. Override the published host ports in a root `.env` file:
   ```env
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   ```
   (And update `DB_PORT` / `REDIS_PORT` in `apps/ikagi-api/.env` and `.env.dev` to match.)

### Windows / WSL2 / macOS Networking Notes
- **Docker Desktop (Windows / macOS):** `host.docker.internal` is provided natively and reinforced by `--add-host=host.docker.internal:host-gateway` in `tools/scripts/docker-runner.mjs`.
- **Linux / WSL2 without Docker Desktop:** Ensure Docker Engine `>= 20.10` is used so `host-gateway` resolves `host.docker.internal`, or attach the container to `jt-workspace_ikag-network` and set `DB_HOST=postgres` and `REDIS_HOST=redis`.

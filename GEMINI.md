# Gemini Project Instructions (`jt-workspace`)

## Workspace Overview

Nx monorepo managed with **Yarn 4 (`yarn@4.18.1`, `nodeLinker: node-modules`)**:

- `apps/ikagi-api` (`@org/ikagi-api`) — NestJS backend API (Auth, Audit Logs, Redis Cache & Rate Limiting, OpenTelemetry, Terminus Health Checks, Swagger)
- `apps/ikagi-web` (`@org/ikagi-web`) — Next.js frontend application
- `libs/nest-lib` (`@jt-workspace/nest-lib`) — Shared NestJS library (TypeORM entities/migrations, Auth, Audit, Cache, Rate Limit, Telemetry, Health, Swagger)
- `libs/next-lib` (`@org/next-lib`) — Shared Next.js/React library

---

## Documentation Policy (Strict)

- **`docs/` is for task files ONLY** (e.g., `docs/task001.md`, `docs/task014.md`). Do **not** create feature or architecture documentation inside `docs/`.
- **Feature & infrastructure documentation belongs in the workspace root** (e.g., `docker-infrastructure.md`, `opentelemetry.md`, `healthcheck.md`).
- Whenever you create or move feature documentation in the workspace root, **always add a reference link to it in [`README.md`](./README.md)**.

---

## Nx & Package Manager Guidelines

- Always prefix Nx commands with `yarn` (e.g., `yarn nx build @jt-workspace/nest-lib`, `yarn nx typecheck @org/ikagi-api`, `yarn nx run-many -t build typecheck`).
- When building or modifying `libs/nest-lib`, rebuild `@jt-workspace/nest-lib` before building/serving dependent apps such as `@org/ikagi-api`.
- Never guess Nx CLI flags — inspect `nx_docs` or `--help` when unsure.
- For scaffolding apps or libraries, invoke the `nx-generate` skill before running generators.
- Do not fabricate verified behavior: always run relevant typechecks/builds/tests after final edits and report exact results.

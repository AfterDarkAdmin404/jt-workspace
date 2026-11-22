# Nx Scripts & Workspace Commands Guide

This workspace is an **Nx `24.0.0`** monorepo managed with **Yarn 4 (`yarn@4.18.1`)**. This guide documents the Nx CLI scripts for generating new applications and libraries, running tasks across projects, inspecting the project graph, formatting code, and maintaining the workspace cache.

> **Convention:** Always prefix Nx commands with `yarn` (for example, `yarn nx ...`) so Yarn resolves the workspace-local `nx` binary (`node_modules/.bin/nx`) instead of relying on a global installation.

---

## Workspace Structure & Active Projects

Workspace packages are organized under `apps/*`, `libs/*`, and `packages/*` (defined in [`package.json`](./package.json)):

| Project Directory | Nx / Package Name        | Type        | Description                                                             |
| :---------------- | :----------------------- | :---------- | :---------------------------------------------------------------------- |
| `apps/ikagi-api`  | `@org/ikagi-api`         | Application | NestJS backend API (Webpack build, TypeORM, Swagger, Telemetry, Health) |
| `apps/ikagi-web`  | `@org/ikagi-web`         | Application | Next.js frontend application (App Router, OpenAPI client generation)    |
| `libs/nest-lib`   | `@jt-workspace/nest-lib` | Library     | Shared NestJS library (buildable via `tsc`)                             |
| `libs/next-lib`   | `@org/next-lib`          | Library     | Shared Next.js/React library (non-buildable, source exports)            |

### Configured Nx Plugins ([`nx.json`](./nx.json))

Nx infers project targets automatically from plugins registered in [`nx.json`](./nx.json):

- **`@nx/js/typescript`** — Infers `typecheck`, `build`, `build-deps`, and `watch-deps` targets from TypeScript project configurations (`tsconfig.lib.json`).
- **`@nx/next/plugin`** — Infers `dev`, `build`, `start`, `serve-static`, `build-deps`, and `watch-deps` targets for Next.js apps.
- **`@nx/webpack/plugin`** — Infers `build`, `serve`, `preview`, `serve-static`, `build-deps`, and `watch-deps` targets for Webpack-backed apps (such as `@org/ikagi-api`).
- **`@nx/jest/plugin`** — Infers `test` targets for projects with Jest configurations.

> **Important (`@jt-workspace/nest-lib`):** `@org/ikagi-api` depends on `@jt-workspace/nest-lib` (`"workspace:*"`). Whenever you modify `libs/nest-lib`, rebuild it with `yarn nx build @jt-workspace/nest-lib` before building or serving `@org/ikagi-api`.

---

## Creating Applications (`yarn nx generate` / `yarn nx g`)

Use `yarn nx g <plugin>:application <directory> [options]` (alias: `app`) to scaffold new applications.

### Key Generator Rules & Safety Flags

1. **Positional `<directory>` is the full project path:** In Nx 24, the first positional argument sets `--directory` (for example `apps/my-app`), **not** a parent folder. Use `--name=@org/my-app` to set the package/Nx project name.
2. **Preview before writing (`--dry-run` / `-d`):** Inspect every file Nx will create or modify without touching disk.
3. **Disable prompts (`--no-interactive`):** Useful in scripts, CI, or automated runs so the generator fails fast instead of waiting on stdin.
4. **Inspect exact schema options (`--help`):**
   ```sh
   yarn nx g @nx/nest:app --help
   yarn nx g @nx/next:app --help
   ```

### 1. Create a NestJS API Application (`@nx/nest:application`)

Scaffolds a NestJS backend service under `apps/<name>`:

```sh
# Preview file creation first
yarn nx g @nx/nest:app apps/billing-api --name=@org/billing-api --dry-run

# Create the NestJS application
yarn nx g @nx/nest:app apps/billing-api \
  --name=@org/billing-api \
  --unitTestRunner=jest \
  --e2eTestRunner=jest \
  --linter=eslint \
  --formatter=prettier \
  --strict=true
```

**Common `@nx/nest:application` options:**

| Option              | Values / Default                             | Description                                                                    |
| :------------------ | :------------------------------------------- | :----------------------------------------------------------------------------- |
| `directory`         | _(required, positional)_                     | Target directory for the app (e.g., `apps/billing-api`)                        |
| `--name`            | string                                       | Package / Nx project name (convention in this repo: `@org/<app-name>`)         |
| `--unitTestRunner`  | `jest`, `vitest`, `none` _(default: `none`)_ | Unit test runner to configure                                                  |
| `--e2eTestRunner`   | `jest`, `none` _(default: `jest`)_           | End-to-end test runner to configure                                            |
| `--linter`          | `eslint`, `oxlint`, `none`                   | Linter configuration                                                           |
| `--formatter`       | `prettier`, `oxfmt`, `none`                  | Code formatter configuration                                                   |
| `--tags`            | comma-separated string                       | Project tags for module-boundary linting and task filtering                    |
| `--frontendProject` | project name (e.g., `@org/ikagi-web`)        | Configures proxy settings for a frontend app                                   |
| `--strict`          | `true` \| `false` _(default: `false`)_       | Enables strict TypeScript compiler checks                                      |
| `--useProjectJson`  | `true` \| `false`                            | Creates a standalone `project.json` instead of inlining `nx` in `package.json` |

**Post-generation checklist for API apps in this repo:**

- Add `"@jt-workspace/nest-lib": "workspace:*"` to the new app's `package.json` and reference `../../libs/nest-lib/tsconfig.lib.json` in `tsconfig.app.json` if it shares Auth, Audit, Cache, Health, or OpenTelemetry modules.
- Sync TypeScript project references with `yarn nx sync`.
- If deploying to Cloud Run, follow the onboarding steps in [`ci-cd-gcp.md`](./ci-cd-gcp.md).

### 2. Create a Next.js Application (`@nx/next:application`)

Scaffolds a Next.js frontend application. Note that [`nx.json`](./nx.json) sets workspace generator defaults for `@nx/next:application` (`style: "css"`, `linter: "none"`).

```sh
# Preview file creation first
yarn nx g @nx/next:app apps/admin-web --name=@org/admin-web --dry-run

# Create the Next.js application (App Router + src/ directory)
yarn nx g @nx/next:app apps/admin-web \
  --name=@org/admin-web \
  --style=css \
  --appDir=true \
  --src=true \
  --unitTestRunner=jest \
  --e2eTestRunner=playwright
```

**Common `@nx/next:application` options:**

| Option             | Values / Default                                          | Description                                                  |
| :----------------- | :-------------------------------------------------------- | :----------------------------------------------------------- |
| `directory`        | _(required, positional)_                                  | Target directory for the app (e.g., `apps/admin-web`)        |
| `--name`           | string                                                    | Package / Nx project name (convention: `@org/<app-name>`)    |
| `--style` (`-s`)   | `css`, `scss`, `none` _(workspace default: `css`)_        | Stylesheet format                                            |
| `--appDir`         | `true` \| `false` _(default: `true`)_                     | Enable Next.js App Router                                    |
| `--src`            | `true` \| `false` _(default: `true`)_                     | Place source files under `src/`                              |
| `--swc`            | `true` \| `false` _(default: `true`)_                     | Enable SWC compiler                                          |
| `--unitTestRunner` | `vitest`, `jest`, `none` _(default: `none`)_              | Unit test runner                                             |
| `--e2eTestRunner`  | `playwright`, `cypress`, `none` _(default: `playwright`)_ | E2E test runner                                              |
| `--tags` (`-t`)    | comma-separated string                                    | Project tags for filtering and boundary rules                |
| `--useProjectJson` | `true` \| `false`                                         | Store Nx targets in `project.json` instead of `package.json` |

### 3. Other Application Generators Installed

| Generator               | Purpose                               | Notable Options                                                                                          |
| :---------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------- |
| `@nx/react:application` | Standalone React SPA                  | `--bundler=vite\|rsbuild\|rspack\|webpack`, `--routing`, `--useReactRouter`, `--port`, `--style`         |
| `@nx/node:application`  | Node.js backend (`express`/`fastify`) | `--framework=express\|fastify\|koa\|nest\|none`, `--bundler=tsc\|rolldown\|esbuild\|webpack`, `--docker` |
| `@nx/web:application`   | Framework-agnostic web app            | `--bundler=vite\|webpack\|none`, `--compiler=swc\|babel`, `--port`                                       |

Example:

```sh
yarn nx g @nx/node:app apps/worker-service --name=@org/worker-service --framework=none --bundler=tsc
```

---

## Creating Libraries & Framework Artifacts

Libraries live under `libs/<name>` and can be **non-buildable** (source `.ts`/`.tsx` compiled directly by consuming apps, as in `@org/next-lib`) or **buildable** (compiled via their own `build` target, as in `@jt-workspace/nest-lib`).

### Library Generators

| Generator           | Use Case                                                 | Key Options                                                                                    |
| :------------------ | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `@nx/js:library`    | Shared TypeScript/JavaScript utilities or domain code    | `--bundler=tsc\|swc\|rollup\|vite\|esbuild\|none`, `--publishable`, `--importPath`, `--strict` |
| `@nx/nest:library`  | Shared NestJS modules, services, entities, guards        | `--buildable`, `--publishable`, `--importPath`, `--service`, `--controller`, `--global`        |
| `@nx/next:library`  | Shared Next.js UI & React Server Components (`./server`) | `--bundler=none\|vite\|rollup`, `--importPath`, `--component`, `--style`, `--compiler`         |
| `@nx/react:library` | Shared React components and hooks                        | `--bundler=none\|vite\|rollup`, `--importPath`, `--component`, `--routing`, `--compiler`       |

Examples:

```sh
# Buildable NestJS shared library
yarn nx g @nx/nest:lib libs/shared-auth --name=@org/shared-auth --buildable --unitTestRunner=jest

# Non-buildable Next.js shared library (nx.json sets React library default unitTestRunner=none)
yarn nx g @nx/next:lib libs/shared-ui --name=@org/shared-ui --bundler=none

# Generic TypeScript library
yarn nx g @nx/js:lib libs/shared-types --name=@org/shared-types --bundler=tsc
```

### Component & Module Generators

Use plugin sub-generators to scaffold individual files inside existing projects:

- **NestJS (`@nx/nest`):** `module`, `controller`, `service`, `resource`, `guard`, `interceptor`, `filter`, `middleware`, `pipe`, `provider`, `gateway`, `resolver`, `decorator`, `class`, `interface`.
  ```sh
  yarn nx g @nx/nest:module users --project=@org/ikagi-api
  yarn nx g @nx/nest:service users --project=@org/ikagi-api
  yarn nx g @nx/nest:controller users --project=@org/ikagi-api
  ```
- **Next.js (`@nx/next`):** `page`, `component`.
  ```sh
  yarn nx g @nx/next:page dashboard --project=@org/ikagi-web
  yarn nx g @nx/next:component header --project=@org/ikagi-web
  ```
- **React (`@nx/react`):** `component` (alias `c`), `hook`.
  ```sh
  yarn nx g @nx/react:component button --project=@org/next-lib
  yarn nx g @nx/react:hook use-auth --project=@org/next-lib
  ```

To discover all generators and executors provided by any installed plugin:

```sh
yarn nx list
yarn nx list @nx/nest
```

---

## Running Tasks (`run`, `run-many`, `affected`)

### Single-Project Tasks (`yarn nx run` / Infix Syntax)

You can invoke any project target using either `yarn nx run <project>:<target>[:<configuration>]` or infix notation `yarn nx <target> <project> [--configuration=<name>]`:

```sh
# Build shared library first (required before building/serving @org/ikagi-api)
yarn nx build @jt-workspace/nest-lib

# Serve NestJS API in development or production configuration
yarn nx serve @org/ikagi-api
yarn nx run @org/ikagi-api:serve:production

# Build NestJS API and prune deployment artifacts
yarn nx build @org/ikagi-api
yarn nx prune @org/ikagi-api

# Next.js frontend workflows
yarn nx dev @org/ikagi-web
yarn nx build @org/ikagi-web
yarn nx start @org/ikagi-web

# Custom target defined in apps/ikagi-web/project.json (OpenAPI TypeScript client)
yarn nx generate-api @org/ikagi-web
yarn nx generate-api @org/ikagi-web --configuration=fetch

# Typecheck a specific project
yarn nx typecheck @org/ikagi-api
```

### Multi-Project Tasks (`yarn nx run-many`)

Run one or more targets across all projects (or a filtered subset) in topological dependency order:

```sh
# Build and typecheck every project (matches workspace verification)
yarn nx run-many -t build typecheck

# Full CI task pipeline (matches .github/workflows/ci.yml)
yarn nx run-many -t lint test build typecheck e2e

# Filter specific projects or exclude projects
yarn nx run-many -t build typecheck -p @jt-workspace/nest-lib @org/ikagi-api
yarn nx run-many -t test --projects="apps/*" --exclude=@org/ikagi-web

# Control parallelism and fail-fast behavior
yarn nx run-many -t build typecheck --parallel=4 --nxBail
```

### Affected Tasks (`yarn nx affected`)

Run targets only for projects modified in your branch/working tree and the downstream projects that depend on them:

```sh
# Run targets for projects affected compared to main
yarn nx affected -t lint test build typecheck --base=main --head=HEAD

# Check uncommitted / untracked local changes only
yarn nx affected -t typecheck --uncommitted --untracked

# Check impact of specific files
yarn nx affected -t build typecheck --files=libs/nest-lib/src/index.ts

# Explain why each task is considered affected without executing it
yarn nx affected -t build --base=main --explain
```

### Common Task Runner Flags

These options work across `run`, `run-many`, and `affected`:

| Flag                           | Description                                                                            |
| :----------------------------- | :------------------------------------------------------------------------------------- |
| `-c`, `--configuration=<name>` | Use a named target configuration (e.g., `production`, `development`, `fetch`)          |
| `--parallel=<n>`               | Max concurrent processes (default: `3`; pass `false` to run sequentially)              |
| `--skipNxCache`                | Ignore cached task outputs and force re-execution                                      |
| `--nxBail`                     | Stop immediately after the first failed task                                           |
| `--exclude=<pattern>`          | Exclude matching projects from execution                                               |
| `--excludeTaskDependencies`    | Skip running upstream dependency targets first                                         |
| `--graph` / `--graph=stdout`   | Visualize the task execution graph in a browser, save to JSON, or print to stdout      |
| `--verbose`                    | Print full stack traces and detailed diagnostic output                                 |
| `--outputStyle=<style>`        | Control terminal output (`tui`, `dynamic`, `static`, `static-failures-only`, `stream`) |

---

## Workspace Inspection, Sync, Formatting & Maintenance

### Inspecting Projects & Dependencies

```sh
# List all projects in the workspace
yarn nx show projects
yarn nx show projects --json

# Filter projects by target or type
yarn nx show projects --with-target serve
yarn nx show projects --type lib --json

# Show full resolved configuration (including plugin-inferred targets) for a project
yarn nx show project @org/ikagi-api --json

# Inspect inputs/outputs used for Nx caching of a target
yarn nx show target @org/ikagi-api:build
yarn nx show target inputs @org/ikagi-api:build
yarn nx show target outputs @org/ikagi-api:build

# Open interactive dependency graph in browser, or print JSON to stdout
yarn nx graph
yarn nx graph --print
```

### Formatting (`prettier`)

```sh
# Check formatting across the entire workspace (used in CI)
yarn nx format:check --all

# Format modified files (or all files with --all)
yarn nx format:write
yarn nx format:write --all
```

### TypeScript Project Reference Sync

```sh
# Sync workspace files and TypeScript project references via sync generators
yarn nx sync

# Verify workspace files are in sync without modifying anything
yarn nx sync:check
```

### Cache, Daemon & Plugin Lifecycle

```sh
# Clear local Nx cache artifacts (.nx) and stop the Nx Daemon
yarn nx reset

# Inspect or start the Nx Daemon
yarn nx daemon

# Print Nx and installed plugin versions (useful for debugging / bug reports)
yarn nx report

# Install and initialize a new Nx plugin
yarn nx add <package-specifier>

# Plan and apply Nx workspace version migrations
yarn nx migrate @nx/workspace@latest
yarn nx migrate --run-migrations=migrations.json --if-exists

# Repair outdated workspace configuration left over from manual upgrades
yarn nx repair

# Import an external repository with git history into the monorepo
yarn nx import <sourceRepository> <destinationDirectory>
```

---

## Integration with Git Hooks, CI & Root Scripts

- **Pre-commit hook ([`.husky/pre-commit`](./.husky/pre-commit)):** Automatically runs `yarn nx run-many -t typecheck` before every commit.
- **CI workflow ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)):** Executes `yarn nx format:check --all` and `yarn nx run-many -t lint test build typecheck e2e` with Nx Cloud task distribution (`yarn dlx nx start-ci-run ...` and `yarn nx fix-ci`).
- **Non-Nx workspace helper scripts ([`package.json`](./package.json)):**
  - `yarn infra:up` / `infra:down` / `infra:logs` / `infra:reset` / `infra:ps` — Docker Compose infrastructure (PostgreSQL, Redis, Jaeger). See [`docker-infrastructure.md`](./docker-infrastructure.md).
  - `yarn docker:build <app>` / `docker:run <app>` / `docker:stop <app>` / `docker:logs <app>` — Containerized app builds and runs.
  - `yarn migration:create` / `generate` / `run` / `revert` / `show` — TypeORM database migrations (see [`README.md`](./README.md#database-migration-commands)).
  - `yarn lint:workflows` — Runs `actionlint` against `.github/workflows/`.

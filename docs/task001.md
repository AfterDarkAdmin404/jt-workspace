# Task: Migrate Nx Monorepo to Yarn and Configure Centralized Database Migrations

## Context
- **Workspace Type:** Nx Monorepo (fresh setup)
- **Applications:** Next.js frontend and NestJS backend (`apps/<NAME>`)
- **Current Package Manager:** `npm`
- **Target Package Manager:** `Yarn` (specify v1 Classic or v4 Berry; default to Yarn Berry/Modern if unspecified)
- **Database/ORM Context:** Assumed TypeORM (standard for NestJS `migration:run`, `revert`, `create`, `show` workflows—confirm.

---

## Objective 1: Migrate Package Manager from `npm` to `Yarn`
Convert the existing Nx workspace from `npm` to `Yarn` cleanly without breaking Nx caching, dependency graph resolution, or build targets.

### Requirements:
1. Remove `package-lock.json` and existing `node_modules`.
2. Initialize Yarn in the root directory and generate `yarn.lock`.
3. Update `nx.json` to ensure Nx recognizes `yarn` as the default package manager (e.g., `cli.packageManager: "yarn"` if applicable for the installed Nx version).
4. Update any hardcoded `npm run` or `npx` commands inside root `package.json`, `project.json` files, or CI/CD configs to `yarn` equivalents.
5. Verify workspace integrity by running `yarn nx graph` and testing build/serve targets for both Next.js and NestJS apps.

---

## Objective 2: Configure Centralized & App-Scoped Database Migration Scripts
Set up a database migration workflow that allows generating migrations centrally from the root while managing execution (`run`, `revert`, `create`, `show`) at the individual NestJS application level (`apps/<NAME>`).

### Requirements:
1. **Root-Level Centralized Migration Generation (`/<root>/package.json`):**
   - Create a root script (e.g., `yarn migration:create` or `yarn db:migration:create`) that accepts an app target name and migration name as arguments/flags.
   - Executing this command must output the generated migration file directly into:
     `apps/<NAME>/src/database/migrations/<timestamp>-<migration_name>.ts`
   - Ensure the command dynamically resolves the target app's data source configuration (e.g., `apps/<NAME>/src/database/data-source.ts`).

2. **App-Level Migration Management (`apps/<NAME>/package.json`):**
   - Configure `apps/<NAME>/package.json` (and/or corresponding Nx `project.json` targets so `nx run <NAME>:migration:<action>` works seamlessly) with the following scripts:
     - `migration:create` — Generates a new empty migration file in `src/database/migrations/`
     - `migration:generate` *(optional/recommended)* — Auto-generates migration from entity diffs into `src/database/migrations/`
     - `migration:run` — Executes all pending migrations against the configured database
     - `migration:revert` — Reverts the most recently executed migration
     - `migration:show` — Lists all migrations and displays their current status (applied vs. pending)

3. **Path & TypeScript Resolution:**
   - Ensure `ts-node` and `tsconfig-paths` (if used) properly resolve monorepo path aliases (e.g., `@org/shared-types`) during CLI migration execution so migrations do not fail on workspace imports.

---

## Expected Deliverables
1. Step-by-step terminal commands to execute the `npm` to `Yarn` migration.
2. Updated root `package.json` and `nx.json` snippets.
3. Sample `data-source.ts` configuration for `apps/<NAME>/src/database/`.
4. Updated `apps/<NAME
# Task: Scaffold Shared Multi-Provider Auth Library (`nest-lib`) with TypeORM Entities/Migrations, Configure DB Environments, and Standardize Dynamic Docker Workflows

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (assumed Node/TypeScript monorepo using npm/pnpm workspaces, Nx, or Turborepo).
- **Target Library & Application:**
- Shared Library: `D:\Development\Projects\jt-workspace\libs\nest-lib`
- Consumer Application: `D:\Development\Projects\jt-workspace\apps\ikagi-api` (Note: User referenced both `ikagi-api` and `ikag-api`—standardize on the actual folder name `ikagi-api` while building CLI validation against `apps/<app-name>`).

- **Database & ORM Stack:**
- PostgreSQL (`host: localhost`, `port: 5432`, `username: postgres`, `password: root`, `database: db_ikag`).
- TypeORM (`typeorm`, `@nestjs/typeorm`, `pg`) using explicit `QueryRunner` DDL methods (`createTable`, `createIndex`, `dropTable`) inside migrations rather than `synchronize: true`.

- **Auth & NestJS Stack (Implicit Defaults):**
- `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-local`, `passport-jwt`, `passport-google-oauth20`, `passport-facebook`, `bcrypt`.
- Node.js v20+ Alpine for containerization; TypeScript path aliases (`@jt-workspace/nest-lib` or `@libs/nest-lib`) mapped in root `tsconfig.base.json` / `tsconfig.json`.

---

## Objective 1: Initialize `libs/nest-lib` with TypeORM Auth Entities, Migrations, and Multi-Provider Auth

Create `libs/nest-lib` as a buildable, shareable NestJS library encapsulating the `User` entity, TypeORM `QueryRunner` migration, and Local/Google/Facebook authentication strategies, then integrate it into `apps/ikagi-api` and its TypeORM `DataSource`.

### Requirements:

1. **Initialize Library Package & Path Aliases (`libs/nest-lib`):**

- Create `libs/nest-lib/package.json` (`"name": "@jt-workspace/nest-lib"`, `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, `"scripts": { "build": "tsc -p tsconfig.lib.json" }`).
- Create `libs/nest-lib/tsconfig.json` and `libs/nest-lib/tsconfig.lib.json` enabling `"declaration": true`, `"emitDecoratorMetadata": true`, and `"experimentalDecorators": true`.
- Register path mappings in root `/tsconfig.base.json` (or `/tsconfig.json`) and `apps/ikagi-api/tsconfig.json`:
- `"@jt-workspace/nest-lib": ["libs/nest-lib/src/index.ts"]`
- `"@jt-workspace/nest-lib/*": ["libs/nest-lib/src/*"]`

- Install required runtime and dev dependencies at workspace/package level: `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-local`, `passport-jwt`, `passport-google-oauth20`, `passport-facebook`, `bcrypt`, and corresponding `@types/*`.

2. **Define Shared TypeORM Entity & `QueryRunner` Migration in `libs/nest-lib`:**

- **Entity (`libs/nest-lib/src/entities/user.entity.ts`):** Define `@Entity('users')` with columns:
- `id`: `uuid` primary generated column (`@PrimaryGeneratedColumn('uuid')`)
- `username`: `varchar`, `unique: true`, `nullable: true`
- `email`: `varchar`, `unique: true`, `nullable: false`
- `passwordHash`: `varchar`, `nullable: true`, `select: false` (nullable to support OAuth-only users)
- `googleId`: `varchar`, `unique: true`, `nullable: true`
- `facebookId`: `varchar`, `unique: true`, `nullable: true`
- `provider`: `varchar` (`'local' | 'google' | 'facebook'`, default `'local'`)
- `avatarUrl`: `varchar`, `nullable: true`
- `createdAt` (`@CreateDateColumn()`) and `updatedAt` (`@UpdateDateColumn()`)

- **Migration (`libs/nest-lib/src/migrations/<timestamp>-CreateUsersTable.ts`):** Implement `MigrationInterface` using `queryRunner: QueryRunner`:
- `up(queryRunner)`: Call `await queryRunner.createTable(new Table({ name: 'users', columns: [...] }), true)` and create explicit unique indexes (`TableIndex`) on `email`, `username`, `googleId`, and `facebookId`.
- `down(queryRunner)`: Drop indexes and call `await queryRunner.dropTable('users', true)`.

- Export `User` entity, `SHARED_ENTITIES = [User]`, and `SHARED_MIGRATIONS = [CreateUsersTable<timestamp>]` from `libs/nest-lib/src/index.ts`.

3. **Implement Multi-Provider `AuthModule` in `libs/nest-lib/src/auth/`:**

- **Dynamic Module (`auth.module.ts`):** Implement `AuthModule.forRootAsync(options)` registering `TypeOrmModule.forFeature([User])`, `PassportModule`, `JwtModule.registerAsync(...)`, `AuthService`, and all Passport strategies.
- **Strategies (`strategies/`):**
- `local.strategy.ts`: Configure `usernameField: 'identifier'` so users can authenticate with either `username` or `email` plus `password` (querying `User` with `addSelect('user.passwordHash')` and verifying via `bcrypt.compare`).
- `jwt.strategy.ts`: Extract Bearer JWT and validate user existence by `sub` (`user.id`).
- `google.strategy.ts`: Configure `passport-google-oauth20` (`scope: ['email', 'profile']`) and call `authService.validateOAuthUser('google', profile)` to link by `googleId`/`email` or auto-provision a new `User`.
- `facebook.strategy.ts`: Configure `passport-facebook` (`profileFields: ['id', 'emails', 'name', 'photos']`) and call `authService.validateOAuthUser('facebook', profile)` to link or auto-provision a `User`.

- **Service & Guards (`auth.service.ts`, `guards/`):**
- Implement `login(user: User)` returning `{ accessToken, user }`, `registerLocal(...)`, and `validateOAuthUser(...)`.
- Export `LocalAuthGuard`, `JwtAuthGuard`, `GoogleAuthGuard`, and `FacebookAuthGuard`.

4. **Integrate `nest-lib` into `apps/ikagi-api` & TypeORM `DataSource`:**

- Import `SHARED_ENTITIES` and `SHARED_MIGRATIONS` into `apps/ikagi-api/src/database/data-source.ts` (or equivalent TypeORM CLI `DataSource` config):
- `entities: [...localEntities, ...SHARED_ENTITIES]`
- `migrations: [...localMigrations, ...SHARED_MIGRATIONS]`
- `synchronize: false`

- Register `TypeOrmModule.forRootAsync(...)` (passing `entities: [...localEntities, ...SHARED_ENTITIES]`) and `AuthModule.forRootAsync(...)` inside `apps/ikagi-api/src/app.module.ts`.
- Create `apps/ikagi-api/src/auth/auth.controller.ts` exposing `POST /auth/login`, `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/facebook`, `GET /auth/facebook/callback`, and `GET /auth/me`.
- **Edge-Case Handling:** Ensure `libs/nest-lib` is compiled (`dist/` built) or transpiled via `tsconfig-paths` when running TypeORM CLI (`typeorm-ts-node-commonjs`) so TypeORM's metadata scanner resolves `User` decorators and `CreateUsersTable` without ESM/CJS mismatch errors.

---

## Objective 2: Configure Migration (`.env`) and Runtime (`.env.dev`) Credentials in `apps/ikagi-api`

Populate the database credentials (`postgres` / `root` / `db_ikag`) across both environment files in `apps/ikagi-api` and ensure proper loading for TypeORM CLI migrations versus NestJS runtime.

### Requirements:

1. **Configure Migration Environment (`apps/ikagi-api/.env`):**

- Populate `apps/ikagi-api/.env` (loaded by TypeORM CLI migration scripts) with:

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=root
DB_NAME=db_ikag
DATABASE_URL=postgresql://postgres:root@localhost:5432/db_ikag

```

2. **Configure Runtime Environment (`apps/ikagi-api/.env.dev`):**

- Populate `apps/ikagi-api/.env.dev` (loaded by NestJS `ConfigModule` and Docker `--env-file`) with:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL Runtime Credentials
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=root
DB_NAME=db_ikag
DATABASE_URL=postgresql://postgres:root@localhost:5432/db_ikag

# JWT Configuration
JWT_SECRET=dev_jwt_secret_change_in_prod
JWT_EXPIRES_IN=1d

# Google OAuth2
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Facebook OAuth2
FACEBOOK_APP_ID=<your_facebook_app_id>
FACEBOOK_APP_SECRET=<your_facebook_app_secret>
FACEBOOK_CALLBACK_URL=http://localhost:3000/auth/facebook/callback

```

3. **Bind Environment Resolution in `apps/ikagi-api`:**

- Configure `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.dev', '.env'] })` in `apps/ikagi-api/src/app.module.ts`, and `dotenv.config({ path: path.resolve(__dirname, '../../.env') })` inside `apps/ikagi-api/src/database/data-source.ts`.
- **Edge-Case Handling:** Verify `.env` and `.env.dev` are ignored in root `/.gitignore`, and provide `.env.example` / `.env.dev.example` templates.

---

## Objective 3: Initialize Monorepo `Dockerfile` and Dynamic App-Targeted Root Docker Scripts

Create a multi-stage `Dockerfile` and a root CLI runner script so Docker commands accept `<app-name>` dynamically (e.g., `npm run docker:build ikagi-api`, `npm run docker:run ikagi-api`) matching the existing migration script convention.

### Requirements:

1. **Create Multi-Stage `Dockerfile` at Workspace Root (`/Dockerfile`):**

- Declare `ARG APP_NAME` and fail early (`RUN test -n "$APP_NAME"`) if omitted.
- **Stage 1 (`builder`):** Copy root workspace manifests (`package.json`, lockfile, `tsconfig*.json`), `libs/nest-lib`, and `apps/${APP_NAME}`. Install workspace dependencies, compile `libs/nest-lib`, and compile `apps/${APP_NAME}`.
- **Stage 2 (`runner`):** Use `node:20-alpine`, copy `libs/nest-lib/dist`, `apps/${APP_NAME}/dist`, production `node_modules`, and `apps/${APP_NAME}/.env.dev`.
- Set `ENV APP_NAME=${APP_NAME}` and `CMD ["sh", "-c", "node apps/${APP_NAME}/dist/main.js"]`.
- Add root `/.dockerignore` excluding `node_modules`, `**/dist`, `.git`, and `.env`.

2. **Create Dynamic Docker Runner Script (`/scripts/docker-runner.js`):**

- Inspect the existing root migration script in `/package.json` and `/scripts/` to mirror its exact argument-parsing and logging conventions.
- Implement `node scripts/docker-runner.js <command> <app-name>` supporting `build`, `run`, `stop`, and `logs`:
- Validate that `<app-name>` is supplied and `path.resolve(__dirname, '../apps', appName)` exists; if missing or mistyped (e.g., `ikag-api` vs `ikagi-api`), print a clear error listing valid directories in `apps/` and exit with code `1`.
- `build`: Execute `docker build --build-arg APP_NAME=<app-name> -t jt-<app-name>:latest -f Dockerfile .`
- `run`: Execute `docker run -d --name jt-<app-name> --env-file apps/<app-name>/.env.dev -p 3000:3000 --add-host=host.docker.internal:host-gateway jt-<app-name>:latest` (removing any stale container with the same name first).
- `stop`: Execute `docker rm -f jt-<app-name>`
- `logs`: Execute `docker logs -f jt-<app-name>`

3. **Register Root `package.json` Scripts (`/package.json`):**

- Add root scripts:

```json
"docker:build": "node scripts/docker-runner.js build",
"docker:run": "node scripts/docker-runner.js run",
"docker:stop": "node scripts/docker-runner.js stop",
"docker:logs": "node scripts/docker-runner.js logs"

```

- **Edge-Case Handling:** Use `path.join` / forward-slash normalization inside `scripts/docker-runner.js` so Docker volume/env-file paths resolve cleanly on Windows (`D:\Development\Projects\jt-workspace`), and allow overriding `DB_HOST=host.docker.internal` at runtime when connecting from a container to host PostgreSQL.

---

## Expected Deliverables

1. **Shared Library (`libs/nest-lib`):**

- `libs/nest-lib/package.json`, `tsconfig.json`, `tsconfig.lib.json`, and updated root path mappings
- `libs/nest-lib/src/entities/user.entity.ts` (`User` TypeORM entity + `SHARED_ENTITIES`)
- `libs/nest-lib/src/migrations/<timestamp>-CreateUsersTable.ts` (`QueryRunner` migration + `SHARED_MIGRATIONS`)
- `libs/nest-lib/src/auth/` (`AuthModule`, `AuthService`, Local/JWT/Google/Facebook strategies, and Guards) and barrel exports in `libs/nest-lib/src/index.ts`

2. **Consumer App & TypeORM Integration (`apps/ikagi-api`):**

- Updated `apps/ikagi-api/src/database/data-source.ts` importing `SHARED_ENTITIES` and `SHARED_MIGRATIONS`
- Updated `apps/ikagi-api/src/app.module.ts` and new `apps/ikagi-api/src/auth/auth.controller.ts`
- Verification command confirming `users` table creation via the root migration script (e.g., `npm run migration:run ikagi-api`)

3. **Database Environment Configuration (`apps/ikagi-api`):**

- `apps/ikagi-api/.env` (migration credentials: `postgres` / `root` / `db_ikag`)
- `apps/ikagi-api/.env.dev` (runtime credentials: `postgres` / `root` / `db_ikag` + JWT & OAuth placeholders)

4. **Docker Setup & Root CLI Scripts (Workspace Root):**

- `/Dockerfile` (supporting `ARG APP_NAME`) and `/.dockerignore`
- `/scripts/docker-runner.js` and updated `/package.json` scripts (`docker:build`, `docker:run`, `docker:stop`, `docker:logs` runnable as `<pkg-manager> docker:build ikagi-api` and `<pkg-manager> docker:run ikagi-api`)

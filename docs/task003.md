# Task: Implement Centralized Authenticated User Audit Logging in `nest-lib` and Integrate into `ikagi-api`

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (TypeScript/NestJS monorepo with shared workspace library `@jt-workspace/nest-lib`).

- **Target Shared Library:** `libs/nest-lib` (reusable across all NestJS applications in `apps/*`).

- **Target Consumer Application:** `apps/ikagi-api` (reference integration consumer).

- **Database & ORM Stack:** PostgreSQL (`db_ikag`) with TypeORM (`typeorm`, `@nestjs/typeorm`, `pg`) using explicit `QueryRunner` DDL migrations (`synchronize: false`).

- **Implicit Defaults & Assumptions:**
- Action types (e.g., `LOGIN`, `LOGOUT`, `CHANGE_PASSWORD`) are stored as normalized uppercase `varchar` values rather than rigid database-level `ENUM` types so new action strings can be introduced across apps without requiring DDL `ALTER TYPE` migrations.
- Uppercase normalization (`action.trim().toUpperCase()`) is enforced both inside the centralized service and via a TypeORM entity lifecycle hook (`@BeforeInsert()` / `@BeforeUpdate()`) as a defensive invariant.
- Audit logging supports both asynchronous/non-blocking fire-and-forget dispatch (via NestJS `EventEmitter2` or safe try/catch wrapper) and direct awaitable persistence so audit failures do not accidentally block critical authentication flows unless explicitly required.

---

## Objective 1: Create Audit Log Entity & TypeORM `QueryRunner` Migration in `libs/nest-lib`

Establish the shared database schema and TypeORM entity for tracking authenticated user actions inside `libs/nest-lib` so any consumer application can import the entity and run migrations consistently.

### Requirements:

1. **Create `UserActionLog` Entity (`libs/nest-lib/src/audit/entities/user-action-log.entity.ts`):**

- Define `@Entity('user_action_logs')` with the following columns:
- `id`: `@PrimaryGeneratedColumn('uuid')` (`string`)
- `userId`: `@Column({ name: 'user_id', type: 'uuid', nullable: true })` (indexed; nullable to allow logging failed/edge-case auth events if needed, or linked via `@ManyToOne` to `User` with `onDelete: 'SET NULL'`)
- `appName`: `@Column({ name: 'app_name', type: 'varchar', length: 100, nullable: true })` (identifies which monorepo app recorded the event, e.g., `ikagi-api`)
- `action`: `@Column({ name: 'action', type: 'varchar', length: 100 })` (e.g., `LOGIN`, `LOGOUT`, `CHANGE_PASSWORD`)
- `ipAddress`: `@Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })` (supports IPv4 and IPv6)
- `userAgent`: `@Column({ name: 'user_agent', type: 'text', nullable: true })`
- `metadata`: `@Column({ name: 'metadata', type: 'jsonb', nullable: true })` (optional structured context such as auth provider `LOCAL`/`GOOGLE`/`FACEBOOK` or changed fields)
- `createdAt`: `@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })`

- **Enforce Uppercase Normalization:** Add a `@BeforeInsert()` and `@BeforeUpdate()` hook on `UserActionLog` that transforms `this.action = this.action.trim().toUpperCase()` to guarantee uppercase persistence even if a repository is called directly.

2. **Create `QueryRunner` Migration (`libs/nest-lib/src/migrations/<timestamp>-CreateUserActionLogsTable.ts`):**

- Implement `MigrationInterface` using explicit `QueryRunner` DDL methods:
- `up(queryRunner: QueryRunner)`: Call `queryRunner.createTable(new Table({ name: 'user_action_logs', ... }), true)` defining all columns above, plus foreign key `FK_user_action_logs_user_id` referencing `users(id)` (`onDelete: 'SET NULL'`) and indexes on `user_id`, `action`, and `created_at` (`queryRunner.createIndex`).
- `down(queryRunner: QueryRunner)`: Drop indexes, drop foreign key, and call `queryRunner.dropTable('user_action_logs', true)`.

- Export the entity and migration from `libs/nest-lib/src/index.ts`.

---

## Objective 2: Build Centralized `AuditLogService` & Dynamic `AuditLogModule` in `libs/nest-lib`

Encapsulate reusable audit-logging business logic, action constants, and request-context extraction inside `libs/nest-lib` so all NestJS applications share a single API.

### Requirements:

1. **Define Action Constants & DTOs (`libs/nest-lib/src/audit/interfaces/audit-log.interface.ts`):**

- Export a standard enum/constant object `UserActionType` (`LOGIN = 'LOGIN'`, `LOGOUT = 'LOGOUT'`, `CHANGE_PASSWORD = 'CHANGE_PASSWORD'`, `REGISTER = 'REGISTER'`, `REFRESH_TOKEN = 'REFRESH_TOKEN'`) while typing the service method parameter as `UserActionType | (string & {})` to allow custom app-specific action strings.
- Define `LogUserActionDto` (`userId: string`, `action: UserActionType | string`, `appName?: string`, `ipAddress?: string`, `userAgent?: string`, `metadata?: Record<string, unknown>`).
- Define `AuditLogModuleOptions` (`appName?: string`, `failSilently?: boolean`, `isGlobal?: boolean`).

2. **Implement Centralized `AuditLogService` (`libs/nest-lib/src/audit/audit-log.service.ts`):**

- Inject `@InjectRepository(UserActionLog)` and `@Optional() @Inject(AUDIT_LOG_OPTIONS) options`.
- Implement `async logAction(payload: LogUserActionDto): Promise<UserActionLog null |>`:
- Validate that `payload.action` is non-empty; normalize `const normalizedAction = payload.action.trim().toUpperCase()`.
- Instantiate and save the `UserActionLog` record, defaulting `appName` to `options?.appName ?? process.env.APP_NAME ?? null`.
- Wrap persistence in `try/catch`: log errors via NestJS `Logger` and, if `options?.failSilently !== false`, return `null` rather than crashing the caller's HTTP request.

- Implement convenience helper `async logFromRequest(req: Request, userId: string, action: UserActionType | string, metadata?: Record<string, unknown>)` that automatically extracts client IP (`x-forwarded-for` first hop or `req.ip`) and `user-agent` header.

3. **Create Configurable `AuditLogModule` (`libs/nest-lib/src/audit/audit-log.module.ts`) & Barrel Exports:**

- Register `TypeOrmModule.forFeature([UserActionLog])` and export `AuditLogService`.
- Provide `AuditLogModule.forRoot(options?: AuditLogModuleOptions)` (supporting `global: options?.isGlobal ?? true`) so consumer apps can import it once in `AppModule`.
- Re-export `AuditLogModule`, `AuditLogService`, `UserActionLog`, `UserActionType`, and DTO/interface types from `libs/nest-lib/src/index.ts`.
- Build `@jt-workspace/nest-lib` (`npm run build` / `tsc`) so compiled `.js` and `.d.ts` artifacts in `libs/nest-lib/dist` are updated before consumer integration.

---

## Objective 3: Integrate Audit Logging into `apps/ikagi-api` and DataSource

Wire the shared `UserActionLog` entity, migration, and `AuditLogService` into `apps/ikagi-api` across authentication endpoints (`Login`, `Logout`, `Change Password`).

### Requirements:

1. **Update TypeORM `DataSource` & `AppModule` in `apps/ikagi-api`:**

- Import `UserActionLog` and `CreateUserActionLogsTable` from `@jt-workspace/nest-lib` into `apps/ikagi-api`'s TypeORM `data-source.ts` (`entities` and `migrations` arrays) so the CLI detects the new schema.
- Import `AuditLogModule.forRoot({ appName: 'ikagi-api', isGlobal: true })` in `apps/ikagi-api/src/app.module.ts` and register `UserActionLog` in `TypeOrmModule.forRoot(...)`.

2. **Instrument Authenticated User Actions in `apps/ikagi-api/src/auth/`:**

- Inject `AuditLogService` into `AuthController` (or `AuthService`) in `apps/ikagi-api`.
- Record uppercase audit logs on key authenticated user flows:
- **Login (`POST /auth/login`, `/auth/google`, `/auth/facebook`):** Call `auditLogService.logFromRequest(req, user.id, UserActionType.LOGIN, { provider })` immediately after successful credential/OAuth verification and JWT issuance.

- **Logout (`POST /auth/logout`):** Protect with `JwtAuthGuard`; call `auditLogService.logFromRequest(req, req.user.id, UserActionType.LOGOUT)`.
- **Change Password (`POST /auth/change-password`):** Protect with `JwtAuthGuard`; after verifying the current password and updating the hashed password, call `auditLogService.logFromRequest(req, req.user.id, UserActionType.CHANGE_PASSWORD)`.

- **Edge-Case Handling:** Ensure `AuditLogService` normalizes mixed-case strings (e.g., `'Change Password'` or `'login'`) to `'CHANGE PASSWORD'` / `'LOGIN'` and handles proxy `x-forwarded-for` comma-separated IP headers cleanly.

---

## Expected Deliverables

1. **Shared Library Audit Module (`libs/nest-lib`):**

- `libs/nest-lib/src/audit/entities/user-action-log.entity.ts` (with `@BeforeInsert()` / `@BeforeUpdate()` uppercase hook)
- `libs/nest-lib/src/migrations/<timestamp>-CreateUserActionLogsTable.ts` (`QueryRunner` DDL migration)
- `libs/nest-lib/src/audit/interfaces/audit-log.interface.ts` (`UserActionType`, `LogUserActionDto`, `AuditLogModuleOptions`)
- `libs/nest-lib/src/audit/audit-log.service.ts` (`logAction` & `logFromRequest` with uppercase normalization)
- `libs/nest-lib/src/audit/audit-log.module.ts` (`AuditLogModule.forRoot(...)`)
- Updated `libs/nest-lib/src/index.ts` exporting all audit entities, migrations, services, modules, and types

2. **Consumer App Integration (`apps/ikagi-api`):**

- Updated `apps/ikagi-api/src/data-source.ts` (or equivalent TypeORM config) registering `UserActionLog` and `CreateUserActionLogsTable`
- Updated `apps/ikagi-api/src/app.module.ts` importing `AuditLogModule.forRoot({ appName: 'ikagi-api' })`
- Updated `apps/ikagi-api/src/auth/auth.controller.ts` (and/or `auth.service.ts`) logging `LOGIN`, `LOGOUT`, and `CHANGE_PASSWORD` actions

3. **Build & Migration Verification Commands:**

- Library build command (`npm --workspace=libs/nest-lib run build` or root build script)
- TypeORM migration execution command targeting `apps/ikagi-api` (`npm run migration:run ikagi-api` / TypeORM CLI `migration:run`)
- SQL / API verification check confirming rows in `user_action_logs` contain uppercase `action` values (`LOGIN`, `LOGOUT`, `CHANGE_PASSWORD`)

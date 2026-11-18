# Task: Enforce Class-Based DTO Validation, Complete Swagger Decorators, and Configurable Multi-Route OpenAPI Endpoints (`docs/auth` & `docs/auth-json`)

## Context

* **Workspace Root:** `D:\Development\Projects\jt-workspace` (TypeScript/NestJS monorepo).
* **Target Scope:**
* Consumer Application: `apps/ikagi-api` (including `src/auth/**`, `src/main.ts`, `.env*`, and all domain controllers/DTOs).
* Shared Library: `libs/nest-lib` (including `src/auth/**`, `src/audit/**`, and any shared DTOs/contracts).


* **Core Stack & Packages (Implicit Defaults):**
* NestJS (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/swagger`) with Express adapter (`swagger-ui-express`).
* Runtime validation & transformation: `class-validator` and `class-transformer`.


* **Architectural & OpenAPI Constraints:**
* **Zero Interfaces for DTOs:** TypeScript `interface` types are erased at runtime, breaking `ValidationPipe` metadata reflection and `@nestjs/swagger` schema generation. Every DTO used in `@Body()`, `@Query()`, `@Param()`, or OpenAPI response schemas must be refactored into a TypeScript `class`.
* **Strict Property-Level Parity:** Every property on every DTO class must carry explicit `class-validator` rules and `@ApiProperty()` / `@ApiPropertyOptional()` decorators.
* **Configurable Segmented Swagger Routes:** `apps/ikagi-api/src/main.ts` must expose Swagger UI at `/docs/auth` (or configurable path via environment variables) and its raw OpenAPI JSON specification at `/docs/auth-json`, supporting modular/scoped OpenAPI document generation cleanly.





---

## Objective 1: Audit All API Routes and Eliminate Interface-Based DTOs

Catalog every HTTP controller endpoint across `apps/ikagi-api` and `libs/nest-lib`, converting all `interface`-based payload, query, parameter, and response DTOs into concrete TypeScript `class` definitions.

### Requirements:

1. **Route & Controller Inventory:**
* Scan all `*.controller.ts` files in `apps/ikagi-api/src/**` (such as `apps/ikagi-api/src/auth/auth.controller.ts` covering `/auth/login`, `/auth/google`, `/auth/facebook`, `/auth/me`, and all other feature modules) and any controllers in `libs/nest-lib/src/**`.
* Inspect every method parameter decorated with `@Body()`, `@Query()`, and `@Param()`, as well as return payloads exposed over HTTP.


2. **Interface-to-Class Refactoring:**
* Locate any DTOs currently declared using `export interface ...` (e.g., inside `apps/ikagi-api/src/**/interfaces/*.ts` or DTO-like interfaces in `libs/nest-lib/src/audit/interfaces/audit-log.interface.ts` if exposed via HTTP endpoints).
* Migrate all HTTP-bound DTOs into dedicated `dto/` directories (`apps/ikagi-api/src/<module>/dto/<action>-<entity>.dto.ts` or `libs/nest-lib/src/<module>/dto/*.dto.ts`) declared as `export class <Name>Dto`, and re-export shared DTOs from `libs/nest-lib/src/index.ts`.
* Retain `interface` declarations strictly for internal DI/service contracts (such as `IAuthUserProvider` or `AuditLogModuleOptions`) that never cross HTTP controller boundaries.


3. **Global `ValidationPipe` & Compiler Metadata Enforcement:**
* Register a global `ValidationPipe` in `apps/ikagi-api/src/main.ts` configured with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, and `transformOptions: { enableImplicitConversion: true }`.
* **Edge-Case Handling:** Verify `tsconfig.json` in both `apps/ikagi-api` and `libs/nest-lib` enables `"emitDecoratorMetadata": true` and `"experimentalDecorators": true` so `class-transformer` and `@nestjs/swagger` reflect property metadata across monorepo workspace boundaries.





---

## Objective 2: Apply Comprehensive `class-validator` Decorators to All DTO Classes

Enforce strict runtime payload sanitization, coercion, and type validation on every property across all request DTOs (body, query, and path parameters).

### Requirements:

1. **Required vs. Optional Property Rules:**
* Decorate required fields with `@IsNotEmpty()` alongside explicit type and format validators (`@IsString()`, `@IsInt()`, `@IsNumber()`, `@IsBoolean()`, `@IsEmail()`, `@IsEnum(...)`, `@IsUUID()`, `@IsDateString()`).
* Decorate optional fields with `@IsOptional()` paired with their exact type and format validators so omitted fields pass while malformed inputs return HTTP `400 Bad Request`.


2. **Nested Objects, Arrays, and Query Parameters:**
* For nested DTO properties, apply both `@ValidateNested({ each: true | false })` and `@Type(() => NestedDto)` from `class-transformer`.
* For array properties, apply `@IsArray()` along with `{ each: true }` on item-level validators (e.g., `@IsString({ each: true })`).
* For query/pagination DTOs (`@Query()`), apply `@Type(() => Number)` or `@Type(() => Boolean)` on numeric/boolean query fields so URL query strings coerce accurately before validation.


3. **Authentication & Security DTO Hardening:**
* Ensure authentication DTOs in `apps/ikagi-api/src/auth/dto/` (e.g., `LoginDto`, `ChangePasswordDto`) enforce string trimming/length bounds (`@MinLength()`, `@MaxLength()`), email/username format constraints, and password complexity rules.



---

## Objective 3: Document All DTO Properties and Controllers with `@ApiProperty` & Swagger Decorators

Guarantee complete, accurate OpenAPI schemas across every DTO property and controller route.

### Requirements:

1. **Property-Level `@ApiProperty()` Coverage on Every DTO:**
* Decorate every required DTO property with `@ApiProperty({ description: '...', example: ... })` and every optional DTO property with `@ApiPropertyOptional({ description: '...', example: ... })`.
* Explicitly declare schema metadata inside `@ApiProperty()` / `@ApiPropertyOptional()` whenever applicable: `type`, `enum`, `enumName`, `isArray: true`, `minimum`, `maximum`, `minLength`, `maxLength`, `format`, and `default` so generated OpenAPI schemas mirror `class-validator` rules.
* Ensure response DTOs (e.g., `AuthTokenResponseDto`, `UserProfileResponseDto`) also use classes with `@ApiProperty()` on every property rather than plain objects or interfaces.


2. **Controller-Level OpenAPI Metadata:**
* Add `@ApiTags('<Module>')` to every controller class in `apps/ikagi-api/src/**/*.controller.ts` (e.g., `@ApiTags('Auth')` on `AuthController`).
* Add `@ApiBearerAuth()` to all JWT-protected endpoints (such as `/auth/me`) and controllers requiring bearer authentication.
* Add `@ApiOperation({ summary: '...', description: '...' })` and explicit `@ApiResponse({ status: 200 | 201 | 400 | 401, type: ResponseDto, description: '...' })` decorators to every route handler.



---

## Objective 4: Configure Configurable Swagger Endpoints (`docs/auth` & `docs/auth-json`) in `main.ts`

Set up environment-configurable OpenAPI documentation routes in `apps/ikagi-api/src/main.ts` so Swagger UI is served at `/docs/auth` and the raw OpenAPI JSON spec is served at `/docs/auth-json`.

### Requirements:

1. **Environment-Driven Swagger Configuration (`apps/ikagi-api/.env` & `.env.dev`):**
* Define configurable environment variables via `ConfigService` in `apps/ikagi-api/src/main.ts` (with sensible defaults):
* `SWAGGER_ENABLED` (default: `true`)
* `SWAGGER_AUTH_PATH` (default: `docs/auth`)
* `SWAGGER_AUTH_JSON_PATH` (default: `docs/auth-json`)
* `SWAGGER_TITLE` (default: `Ikagi API - Auth & Core Services`)
* `SWAGGER_VERSION` (default: `1.0.0`)




2. **Scoped Document & Route Registration in `apps/ikagi-api/src/main.ts`:**
* Build a dedicated `DocumentBuilder` configuration with `.setTitle(...)`, `.setVersion(...)`, and `.addBearerAuth()`.
* Generate the OpenAPI document using `SwaggerModule.createDocument(app, authSwaggerConfig, { include: [AuthModule] })` (or full/scoped module list as configured) so `/docs/auth` cleanly documents the Auth API surface without colliding with future domain doc routes (e.g., `docs/admin`, `docs/orders`).
* Mount Swagger UI and explicit JSON output via `SwaggerModule.setup(swaggerAuthPath, app, authDocument, { jsonDocumentUrl: swaggerAuthJsonPath, swaggerOptions: { persistAuthorization: true } })`:
* **Edge-Case Handling:** Verify exact path normalization in NestJS `@nestjs/swagger`: passing `'docs/auth'` as the setup path and `'docs/auth-json'` as `jsonDocumentUrl` (or registering an explicit Express GET handler at `/${swaggerAuthJsonPath}` returning `authDocument` if an older `@nestjs/swagger` version is installed) guarantees both `/docs/auth` and `/docs/auth-json` resolve reliably without double-slash or global-prefix conflicts (`useGlobalPrefix: true` if `app.setGlobalPrefix(...)` is active).







---

## Expected Deliverables

1. **Refactored & Fully Decorated DTO Classes (`apps/ikagi-api` & `libs/nest-lib`):**
* Zero `interface`-based DTOs across all HTTP boundaries; all DTOs implemented as TypeScript `class` files under `apps/ikagi-api/src/**/dto/*.dto.ts` (and `libs/nest-lib/src/**/dto/*.dto.ts` where shared).
* Every DTO property annotated with `class-validator` / `class-transformer` decorators and `@ApiProperty()` / `@ApiPropertyOptional()` with `description`, `example`, and constraint metadata.


2. **Updated Controllers, Bootstrap & Environment Config (`apps/ikagi-api`):**
* Updated controllers (`apps/ikagi-api/src/auth/auth.controller.ts` and all other feature controllers) using class DTOs and `@ApiTags()`, `@ApiOperation()`, `@ApiBearerAuth()`, and `@ApiResponse()`.


* Updated `apps/ikagi-api/src/main.ts` enforcing global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) and configurable `SwaggerModule` serving `/docs/auth` and `/docs/auth-json`.
* Updated `apps/ikagi-api/.env` and `apps/ikagi-api/.env.dev` with `SWAGGER_ENABLED`, `SWAGGER_AUTH_PATH=docs/auth`, and `SWAGGER_AUTH_JSON_PATH=docs/auth-json`.




3. **Verification & Validation Checks:**
* Workspace build check (`npm --workspace=libs/nest-lib run build` and `npm --workspace=apps/ikagi-api run build`) passing with zero TypeScript or decorator metadata errors.


* Runtime validation test sending malformed/unknown fields to `POST /auth/login` returning HTTP `400 Bad Request`.
* HTTP verification confirming `GET http://localhost:3000/docs/auth` renders Swagger UI and `GET http://localhost:3000/docs/auth-json` returns valid OpenAPI 3.0 JSON containing all DTO schemas and property descriptions.
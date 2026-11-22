# Frontend OpenAPI Client Generation (`generate:api` vs `generate:api:fetch`)

`apps/ikagi-web` uses [`@hey-api/openapi-ts`](https://heyapi.dev/) (configured in [`apps/ikagi-web/openapi-ts.config.ts`](./apps/ikagi-web/openapi-ts.config.ts)) and the helper script [`apps/ikagi-web/scripts/generate-api.mjs`](./apps/ikagi-web/scripts/generate-api.mjs) to generate strongly typed TypeScript models, SDK functions, and Axios clients from OpenAPI/Swagger specifications.

---

## Quick Comparison: `generate:api` vs `generate:api:fetch`

Both package scripts in [`apps/ikagi-web/package.json`](./apps/ikagi-web/package.json) run `apps/ikagi-web/scripts/generate-api.mjs` — the difference is **where the OpenAPI spec comes from**:

| Aspect                     | `generate:api` (`node scripts/generate-api.mjs`)                                                                    | `generate:api:fetch` (`node scripts/generate-api.mjs --fetch`)                                               |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| **Network / API needed?**  | **No (offline)** — reads local `.json` files already on disk.                                                       | **Yes (online)** — fetches live OpenAPI JSON from a running API (e.g., `yarn nx serve @org/ikagi-api`).      |
| **Default input source**   | Scans `apps/ikagi-web/src/api/swagger/*.json` (alphabetical order).                                                 | Refreshes every existing `<service>.json` in `src/api/swagger/` by fetching `<baseUrl>/docs/<service>-json`. |
| **Writes Swagger JSON?**   | No — leaves `src/api/swagger/*.json` untouched.                                                                     | Yes — writes/overwrites formatted OpenAPI JSON into `src/api/swagger/<service>.json`.                        |
| **Generated code output**  | Writes `src/api/generated/<name>/` (`client/`, `core/`, `client.gen.ts`, `sdk.gen.ts`, `types.gen.ts`, `index.ts`). | Same generated output in `src/api/generated/<service>/` after saving the fetched spec.                       |
| **If `swagger/` is empty** | Exits cleanly (`0`) with `"No OpenAPI .json specs found in src/api/swagger. Nothing to generate."`                  | Exits with error (`1`) unless `--service <name>` or `--url <url>` is provided.                               |
| **Nx target equivalent**   | `yarn nx generate-api @org/ikagi-web`                                                                               | `yarn nx generate-api @org/ikagi-web --configuration=fetch`                                                  |
| **When to use**            | Regenerating clients from committed/local specs (CI, clean checkouts, offline work).                                | Pulling updated backend endpoints/DTOs after changing NestJS controllers or Swagger decorators.              |

---

## How Each Command Works Under the Hood

### 1. `generate:api` (Local Spec Codegen)

1. Loads environment variables from `apps/ikagi-web/.env` and `apps/ikagi-web/.env.local` (`.env.local` takes precedence).
2. Unless `--spec <path>` is passed, scans `apps/ikagi-web/src/api/swagger/*.json`.
3. For each `.json` file (for example `src/api/swagger/auth.json`), invokes `@hey-api/openapi-ts` with `openapi-ts.config.ts` using:
   - `OPENAPI_INPUT` = path to the spec file
   - `OPENAPI_OUTPUT` = `src/api/generated/<specName>` (for example `src/api/generated/auth`)
4. Runs the three configured plugins in `openapi-ts.config.ts`:
   - `@hey-api/typescript` (`types.gen.ts`)
   - `@hey-api/sdk` (`sdk.gen.ts`)
   - `@hey-api/client-axios` (`client.gen.ts`, `client/`, `core/`)

### 2. `generate:api:fetch` (Fetch Live Swagger + Codegen)

1. Resolves the API base URL in order:
   1. `NEXT_PUBLIC_API_URL` (for example `http://localhost:3001` in [`apps/ikagi-web/.env.example`](./apps/ikagi-web/.env.example))
   2. `VITE_API_URL`
   3. Fallback: `http://localhost:3000`
2. Determines which service specs to fetch:
   - **`--url <url>`:** Fetches directly from the given URL and infers `<service>` from the last URL path segment (stripping a trailing `-json`), unless `--service` overrides the name.
   - **`--service <name>`:** Accepts one or more comma-separated service names (e.g., `--service auth,profile`) and fetches `<baseUrl>/docs/<service>-json`.
   - **No `--service` / `--url`:** Reads existing `*.json` filenames in `apps/ikagi-web/src/api/swagger/` and refreshes each one from `<baseUrl>/docs/<name>-json`.
3. Validates that the HTTP response succeeds (`2xx`) and contains an `"openapi"` or `"swagger"` field, then saves the formatted JSON to `apps/ikagi-web/src/api/swagger/<service>.json`.
4. Runs `@hey-api/openapi-ts` for each saved spec to regenerate `apps/ikagi-web/src/api/generated/<service>/`.

> **Tip:** If the backend is not running, `generate:api:fetch` fails on `ECONNREFUSED` and reminds you to start `@org/ikagi-api` (`yarn nx serve @org/ikagi-api`).

---

## Command Reference & Common Flags

### Running via Yarn (Workspace Root or App Directory)

```sh
# Offline regeneration from apps/ikagi-web/src/api/swagger/*.json
yarn --cwd apps/ikagi-web generate:api

# Refresh all existing specs in src/api/swagger/ from running ikagi-api, then regenerate
yarn --cwd apps/ikagi-web generate:api:fetch
```

### Running via Nx ([`apps/ikagi-web/project.json`](./apps/ikagi-web/project.json))

```sh
# Offline regeneration
yarn nx generate-api @org/ikagi-web

# Fetch + regenerate
yarn nx generate-api @org/ikagi-web --configuration=fetch
```

### CLI Options Supported by `generate-api.mjs`

| Flag               | Description                                                                                                                                       |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--fetch`          | Fetch `/docs/<service>-json` into `src/api/swagger/<service>.json` before generating.                                                             |
| `--service <name>` | Service name(s) to fetch (comma-separated, e.g. `--service auth,profile`).                                                                        |
| `--url <url>`      | Fetch OpenAPI JSON from an arbitrary URL (implies `--fetch`).                                                                                     |
| `--spec <path>`    | Generate client code from a specific local OpenAPI JSON file instead of scanning `src/api/swagger/`.                                              |
| `--dry-run`        | With `--fetch`, validates the remote OpenAPI JSON without writing files or running codegen; offline, passes `--dry-run` to `@hey-api/openapi-ts`. |
| `-h`, `--help`     | Print CLI usage and option summary.                                                                                                               |

**Examples with extra flags:**

```sh
# Onboard a brand-new service spec (e.g. billing) from running ikagi-api
yarn --cwd apps/ikagi-web generate:api:fetch -- --service billing

# Fetch multiple services at once
yarn --cwd apps/ikagi-web generate:api:fetch -- --service auth,billing

# Fetch from a custom URL
yarn --cwd apps/ikagi-web generate:api -- --url http://localhost:3001/docs/auth-json

# Generate from a single local spec file without touching other services
yarn --cwd apps/ikagi-web generate:api -- --spec src/api/swagger/auth.json

# Validate remote OpenAPI payload without modifying files
yarn --cwd apps/ikagi-web generate:api:fetch -- --dry-run
```

---

## Runtime Integration (`api-client.ts`)

[`apps/ikagi-web/src/api/api-client.ts`](./apps/ikagi-web/src/api/api-client.ts) wraps the generated Axios client (`./generated/auth/client.gen`) to:

- Configure `baseURL` from `NEXT_PUBLIC_API_URL` (fallback `http://localhost:3000`).
- Inject the `Authorization: Bearer <token>` header from `tokenStorage` on outgoing requests.
- Normalize Axios/API errors into `ApiError` and clear tokens / invoke the unauthorized handler on `401` responses.

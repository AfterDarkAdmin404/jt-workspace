# Task: Enforce GitHub PAT Authentication via `.npmrc` Across `npm`, `yarn`, Docker, and CI/CD

## Context

* **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing `libs/nest-lib`, `apps/ikag-api`, and `apps/ikag-web`).


* **Package Managers:** `yarn` (primary, root `/yarn.lock`) and `npm`.


* **Authentication Mechanism:** Environment-interpolated GitHub Personal Access Token (`GH_PAT`) referenced in root `/.npmrc`—plaintext tokens must **never** be committed to Git.
* **Registry Scope (Implicit Default):** Assumes GitHub Packages (`[https://npm.pkg.github.com](https://npm.pkg.github.com)`) for scoped packages (`@<org-scope>:registry=[https://npm.pkg.github.com](https://npm.pkg.github.com)`) with `always-auth=true`. If routing *all* packages through a private registry/proxy, replace the scoped registry line with a root `registry=` entry.
* **Yarn Version Note:** Yarn Classic (v1) reads `/.npmrc` natively. If the workspace runs Yarn Berry (v2/v3/v4), `.npmrc` auth directives are ignored and must be mirrored in `/.yarnrc.yml`.
* **Container & CI Footprint:** Dedicated API Dockerfiles (`apps/<name>-api/Dockerfile`) and reusable GitHub Actions workflows (`/.github/workflows/_reusable-api-gcp-deploy.yml`).



---

## Objective 1: Configure Root `.npmrc` and Enforce a `preinstall` Token Guard

Ensure every `npm` and `yarn` registry operation requires `GH_PAT` and immediately blocks execution with a clear error when the token is missing.

### Requirements:

1. **Create Root `/.npmrc`:**
* Add environment-variable-backed authentication and strict auth enforcement:
```ini
@<org-scope>:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PAT}
always-auth=true

```


* **Yarn Berry Adaptation (if `/.yarnrc.yml` exists):** Mirror the configuration in `/.yarnrc.yml`:
```yaml
npmScopes:
  <org-scope>:
    npmRegistryServer: "https://npm.pkg.github.com"
    npmAlwaysAuth: true
    npmAuthToken: "${GH_PAT:-}"

```




2. **Add a Hard `preinstall` Guard Script (`/scripts/check-gh-pat.js`):**
* Because `npm` and `yarn` may skip authenticating against public `registry.npmjs.org` packages even when `/.npmrc` is present, enforce token presence on *every* install/add/ci invocation via a lightweight Node script:
* Check `process.env.GH_PAT && process.env.GH_PAT.trim().length > 0`.
* If missing, print an explicit setup error (referencing `GH_PAT` and `/docs/npm-auth-setup.md`) to `stderr` and exit with code `1`.


* Register the hook in root `/package.json`:
```json
"scripts": {
  "preinstall": "node scripts/check-gh-pat.js"
}

```


* **Edge-Case Handling:** Keep `/scripts/check-gh-pat.js` zero-dependency (pure Node.js built-ins only) since `preinstall` executes *before* `node_modules` exists.



---

## Objective 2: Configure Local Developer Environment & Git Hygiene

Prevent accidental token leaks while giving developers a repeatable one-time setup across Windows and POSIX shells.

### Requirements:

1. **Update `/.gitignore`:**
* Ensure root `/.npmrc` remains tracked (as a token-free template using `${GH_PAT}`), while explicitly ignoring local overrides:
```gitignore
.npmrc.local
.env.npm

```




2. **Document Local Token Provisioning (`/docs/npm-auth-setup.md`):**
* Specify required GitHub PAT scopes:
* **Classic PAT:** `read:packages` (minimum for install/CI) and `write:packages` (for publishing).
* **SSO Note:** Remind developers to authorize the PAT for the GitHub Organization if SAML SSO is enabled.


* Provide OS-specific persistent setup commands:
* **Windows (PowerShell — Persistent User Env):** `[System.Environment]::SetEnvironmentVariable("GH_PAT", "<your_token>", "User")` (restart terminal to apply).
* **macOS / Linux (`~/.zshrc` or `~/.bashrc`):** `export GH_PAT="<your_token>"`.





---

## Objective 3: Propagate `GH_PAT` Securely in Docker Builds and GitHub Actions

Ensure containerized builds and CI pipelines authenticate cleanly without leaking `GH_PAT` into Docker image layers or build logs.

### Requirements:

1. **Update Dedicated API Dockerfiles (`apps/<name>-api/Dockerfile`):**
* Copy root `/.npmrc` (and `/scripts/check-gh-pat.js`) alongside `/package.json` and `/yarn.lock` in the `builder` stage.


* Mount `GH_PAT` via Docker BuildKit secrets rather than `ARG`/`ENV` so the token is never persisted in image layers or `docker history`:
```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=gh_pat \
    GH_PAT="$(cat /run/secrets/gh_pat)" yarn install --frozen-lockfile

```


* **Edge-Case Handling:** Ensure `/.dockerignore` does **not** exclude `/.npmrc` or `/scripts/check-gh-pat.js`, while continuing to exclude `.env*`, `node_modules`, and `.git`.




2. **Update GitHub Actions Workflows (`/.github/workflows/_reusable-api-gcp-deploy.yml`):**
* Pass `GH_PAT` into the `yarn install --frozen-lockfile` step via `env:`:


```yaml
- name: Install dependencies
  env:
    GH_PAT: ${{ secrets.GH_PAT || secrets.GITHUB_TOKEN }}
  run: yarn install --frozen-lockfile

```


* Forward the token to `docker build` using BuildKit `--secret`:


```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=gh_pat,env=GH_PAT \
  -f "${{ inputs.dockerfile_path }}" \
  -t "${{ inputs.app_name }}:${{ github.sha }}" \
  .

```


* Configure `packages: read` under `permissions:` in `/.github/workflows/_reusable-api-gcp-deploy.yml` if falling back to `secrets.GITHUB_TOKEN` for same-org packages.



---

## Expected Deliverables

1. **Registry & Guard Configuration:**
* Root `/.npmrc` using `${GH_PAT}` and `always-auth=true` (plus `/.yarnrc.yml` if Yarn Berry is active).
* Zero-dependency `/scripts/check-gh-pat.js` wired to `"preinstall"` in root `/package.json`.
* Updated `/.gitignore` excluding `.npmrc.local` and `.env.npm`.


2. **Docker & CI/CD Updates:**
* Updated `apps/<name>-api/Dockerfile` (starting with `apps/ikag-api/Dockerfile`) using `--mount=type=secret,id=gh_pat` for `yarn install`.


* Updated `/.github/workflows/_reusable-api-gcp-deploy.yml` injecting `GH_PAT` into dependency installation and `docker build --secret`.




3. **Documentation (`/docs/npm-auth-setup.md`):**
* Token creation steps (scopes + SSO), Windows/macOS/Linux env setup, and Docker local build command (`DOCKER_BUILDKIT=1 docker build --secret id=gh_pat,env=GH_PAT ...`).


4. **Verification Checks:**
* Running `yarn install` or `npm install` in a shell **without** `GH_PAT` set fails immediately at `preinstall` with exit code `1`.
* Running `yarn install` with a valid `GH_PAT` succeeds cleanly.
* Running `docker history <image>` on a built `apps/ikag-api/Dockerfile` image confirms zero occurrences of the `GH_PAT` token value.
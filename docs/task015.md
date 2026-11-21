# Task: Create Per-App GCP Deployment Workflow for Yarn-Based APIs with Skippable GCP Authentication

## Context

* **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and API applications following the `apps/<name>-api` convention, e.g., `apps/ikag-api`).


* **Package Manager:** `yarn` (with root `/yarn.lock`; confirm whether the workspace uses Yarn Classic v1 `--frozen-lockfile` or Yarn Berry v3/v4 `--immutable` before finalizing the install command).
* **Containerization Pattern:** Each API maintains its own dedicated `apps/<name>-api/Dockerfile` rather than a single shared root `/Dockerfile`. Docker builds must still execute with the workspace root (`.`) as the build context so `libs/nest-lib`, root `/package.json`, and `/yarn.lock` remain accessible to the container build.
* **Target Branches & Trigger Behavior:** Merging changes touching `apps/<name>-api/**` (or shared `libs/nest-lib/**`) into `staging` or `production` triggers that specific API's build and deployment pipeline.
* **GCP Provisioning State:** GCP infrastructure (Project, Artifact Registry, Cloud Run, Workload Identity Federation) is **not yet provisioned**. The workflow must execute real Yarn/Nx and Docker builds today while cleanly **skipping GCP authentication and deployment** until a toggle variable (`vars.GCP_DEPLOY_ENABLED == 'true'`) is enabled.
* **Implicit Defaults & Assumptions:**
* Node.js `20.x` LTS on `ubuntu-latest` runners.
* Target GCP stack: Artifact Registry (`<GCP_REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<GCP_AR_REPO>/<name>-api`) + Cloud Run (`gcloud run deploy`), authenticated via keyless OIDC (`google-github-actions/auth@v2`) once enabled.





---

## Objective 1: Create Reusable Yarn + GCP Deployment Workflow (`/.github/workflows/_reusable-api-gcp-deploy.yml`)

Centralize the Yarn/Nx build, dedicated `Dockerfile` verification, and skippable GCP deployment logic in a parameterized `workflow_call` template so every `apps/<name>-api` service can onboard with a minimal caller file.

### Requirements:

1. **Define Workflow Inputs & Secrets (`/.github/workflows/_reusable-api-gcp-deploy.yml`):**
* Configure `on: workflow_call` with typed inputs:
* `app_name` (`string`, required — e.g., `ikag-api`)
* `dockerfile_path` (`string`, required — e.g., `apps/ikag-api/Dockerfile`)
* `node_version` (`string`, default: `'20'`)
* `container_port` (`number`, default: `3000`)


* Accept inherited or explicit optional secrets (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`).


2. **Configure `build-and-verify` Job (Runs Live on Every Merge):**
* Run on `ubuntu-latest` with `actions/checkout@v4` (`fetch-depth: 0` for Nx graph resolution).


* Configure Node.js via `actions/setup-node@v4` with `node-version: ${{ inputs.node_version }}` and `cache: 'yarn'`.
* Install dependencies via `yarn install --frozen-lockfile` (or `yarn install --immutable` if using Yarn Berry).
* Build shared library and target API:
* `yarn nx build nest-lib`
* `yarn nx build ${{ inputs.app_name }}`


* Verify the app's dedicated Dockerfile builds cleanly from the workspace root context:
```bash
docker build \
  -f "${{ inputs.dockerfile_path }}" \
  -t "${{ inputs.app_name }}:${{ github.sha }}" \
  .

```




3. **Configure `deploy-gcp` Job with Skippable Authentication:**
* Set `needs: build-and-verify`, `permissions: { contents: read, id-token: write }`, and map the GitHub Environment dynamically to the target branch (`environment: ${{ github.ref_name }}-gcp` -> `staging-gcp` or `production-gcp`).
* Define fallback-safe environment variables so missing GCP variables never cause YAML evaluation errors:
```yaml
env:
  GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID || 'placeholder-gcp-project' }}
  GCP_REGION: ${{ vars.GCP_REGION || 'asia-southeast1' }}
  GCP_AR_REPO: ${{ vars.GCP_AR_REPO || 'api-docker-repo' }}
  GCP_SERVICE_NAME: ${{ inputs.app_name }}-${{ github.ref_name }}

```


* **Skip / Dry-Run Step (`if: vars.GCP_DEPLOY_ENABLED != 'true'`):**
* Print a clear notice that GCP authentication and deployment are skipped (`GCP_DEPLOY_ENABLED` is not `'true'`), log the resolved target environment (`staging-gcp` / `production-gcp`), image URI (`${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_AR_REPO}/${{ inputs.app_name }}:${{ github.sha }}`), and Cloud Run service name, then exit `0`.


* **Live GCP Auth & Deploy Steps (`if: vars.GCP_DEPLOY_ENABLED == 'true'`):**
* Authenticate via `google-github-actions/auth@v2` (`workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}`, `service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}`).


* Run `google-github-actions/setup-gcloud@v2` and `gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet`.


* Build/tag and push the image using `apps/<name>-api/Dockerfile` to Artifact Registry with both `:${{ github.sha }}` and `:${{ github.ref_name }}-latest` tags.
* Deploy to Cloud Run via `gcloud run deploy "${{ env.GCP_SERVICE_NAME }}" --image ... --region "${{ env.GCP_REGION }}" --platform managed --port "${{ inputs.container_port }}"`.




* **Edge-Case Handling:**
* **Docker Layer Sharing Across Jobs:** GitHub-hosted runners do not persist local Docker images between separate jobs (`build-and-verify` vs `deploy-gcp`). Either save/upload the image artifact between jobs or rebuild with `docker/build-push-action@v6` + `cache-from/cache-to: type=gha` inside `deploy-gcp` when `GCP_DEPLOY_ENABLED == 'true'`.
* **Monorepo `.dockerignore`:** Ensure root `/.dockerignore` excludes `node_modules`, `.git`, `.nx`, `dist`, and `.env` so sending `.` as the Docker build context remains fast and does not leak local secrets.





---

## Objective 2: Configure Per-App Branch-Merge Trigger Workflows (`/.github/workflows/<name>-api-deploy.yml`)

Create a dedicated caller workflow for each `apps/<name>-api` service (starting with `ikag-api`) so merges into `staging` or `production` only trigger pipelines for affected APIs.

### Requirements:

1. **Create API Caller Workflow (`/.github/workflows/ikag-api-deploy.yml`):**
* Set `name: ikag-api-deploy`.
* Trigger on `push` to `staging` and `production` (which fires automatically when a PR is merged into either branch) with strict `paths` filtering:
```yaml
name: ikag-api-deploy

on:
  push:
    branches:
      - staging
      - production
    paths:
      - 'apps/ikag-api/**'
      - 'libs/nest-lib/**'
      - 'package.json'
      - 'yarn.lock'
      - 'nx.json'
      - 'tsconfig.base.json'
      - '.github/workflows/ikag-api-deploy.yml'
      - '.github/workflows/_reusable-api-gcp-deploy.yml'

concurrency:
  group: ikag-api-deploy-${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  deploy:
    uses: ./.github/workflows/_reusable-api-gcp-deploy.yml
    with:
      app_name: ikag-api
      dockerfile_path: apps/ikag-api/Dockerfile
    secrets: inherit

```


* **Edge-Case Handling:**
* **Why `push` instead of `pull_request: [closed]`:** `push` to `staging`/`production` natively triggers only on actual merges (ignoring closed/unmerged PRs automatically) and ensures `github.ref_name` resolves directly to `staging` or `production`.
* **Branch Protection:** Do **not** mark `<name>-api-deploy` as a Required Status Check in branch protection rules, as path-filtered workflows are skipped when unrelated apps change.







---

## Objective 3: Configure GitHub Environments, Variables & Verification

Prepare the repository settings for `staging` and `production` separation and verify the workflow executes end-to-end with GCP authentication skipped.

### Requirements:

1. **Create GitHub Environments:**
* In GitHub **Settings -> Environments**, create `staging-gcp` and `production-gcp` (optionally enabling Required Reviewers on `production-gcp`).
* Keep `GCP_DEPLOY_ENABLED` unset (or `'false'`) in both environments until GCP is provisioned.


2. **Document Activation Variables & Secrets (`/docs/ci-cd-gcp.md`):**
* Document the per-environment **Variables** (`GCP_DEPLOY_ENABLED`, `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_AR_REPO`) and **Secrets** (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) required to flip each environment from dry-run to live GCP deployment.


* Document the 1-file onboarding steps for adding a new `apps/<name>-api` service (copy `ikag-api-deploy.yml`, replace `ikag-api` with `<name>-api`).


3. **Verify Workflow Execution:**
* Validate YAML syntax locally with `actionlint` (or GitHub Actions UI).
* Merge a test change under `apps/ikag-api/` into `staging` -> confirm `build-and-verify` runs `yarn install`, `yarn nx build nest-lib`, `yarn nx build ikag-api`, and `docker build -f apps/ikag-api/Dockerfile .`, and `deploy-gcp` skips GCP auth cleanly with a green check.
* Merge a test change touching only `apps/ikag-web/` into `staging` -> confirm `ikag-api-deploy` does **not** trigger.



---

## Expected Deliverables

1. **Reusable GCP Deployment Workflow (`/.github/workflows/_reusable-api-gcp-deploy.yml`):**
* Parameterized `workflow_call` pipeline running Yarn/Nx builds, dedicated `apps/<name>-api/Dockerfile` verification, and a `GCP_DEPLOY_ENABLED`-gated GCP auth/Artifact Registry/Cloud Run deployment job.


2. **Per-App Trigger Workflow (`/.github/workflows/ikag-api-deploy.yml`):**
* Path-filtered `push` workflow targeting `staging` and `production` branches with per-branch concurrency control.


3. **GCP Onboarding Documentation (`/docs/ci-cd-gcp.md`):**
* Reference matrix for `staging-gcp` and `production-gcp` GitHub Environment variables/secrets and instructions for onboarding future `apps/<name>-api` services.


4. **Verification Output:**
* Green GitHub Actions run on a `staging` merge touching `apps/ikag-api/` showing passing Yarn/Nx/Docker builds and cleanly skipped GCP authentication.
* Confirmed non-trigger on merges modifying unrelated apps (e.g., `apps/ikag-web/`).